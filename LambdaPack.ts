import * as fs from "fs-extra"
import {exec} from 'child_process';
import * as path from "path";
import * as walker from "module-walker";
import * as _ from "lodash";
import {terminal} from "terminal-kit";
import * as async from "async";
import * as findUp from "find-up";
import * as tmp from "tmp";
import * as isBuiltinModule from "is-builtin-module";
import * as zip from "cross-zip";

export class LambdaPack {
    static package(lambdaHandlerFilePath: string, otherFiles: string[], outputFileName: string, outputProgressToConsole: boolean = true, excludeAWSSDK: boolean = true, callback?: (error: Error) => void) {

        let tmpDir;

        async.waterfall([
            // Find a package.json file in the path
            (done) => {
                if (outputProgressToConsole) terminal.blue("Finding package.json...\n");
                findUp("package.json").then(filepath => {

                    if (outputProgressToConsole) terminal(`package.json file ${filepath ? "was found at " + filepath : "was not found"}\n`);

                    done(null, filepath);
                });
            },
            (packageJSONFile, done) => {
                if (outputProgressToConsole) terminal.blue("Determining dependencies...\n");

                let installedPackages;
                let packageJSON: any = {};

                if (packageJSONFile) {
                    packageJSON = require(packageJSONFile);
                    installedPackages = packageJSON.dependencies;
                }

                walker({}).walk(lambdaHandlerFilePath).then((nodes) => {

                    let requiredModules = {};
                    let requiredLocalFiles = [];

                    _.each(nodes, (node) => {
                        if (node.foreign) {

                            let moduleName = node.id;
                            let moduleVersion = "*";

                            // Skip built in modules
                            if (isBuiltinModule(moduleName)) {
                                return;
                            }

                            if (installedPackages && installedPackages[moduleName]) {
                                moduleVersion = installedPackages[moduleName];
                            }

                            requiredModules[moduleName] = moduleVersion;
                            if (outputProgressToConsole) terminal("Found module: ").green.noFormat(`${moduleName} (${moduleVersion})\n`);
                        }
                        else {
                            requiredLocalFiles.push(node.filename);
                            if (outputProgressToConsole) terminal("Found file: ").blue.noFormat(`${node.filename}\n`);
                        }
                    });

                    if (excludeAWSSDK) {
                        delete requiredModules["aws-sdk"];
                    }

                    done(null, requiredModules, requiredLocalFiles, packageJSON);
                });
            },
            (requiredModules, requiredLocalFiles, packageJSON, done) => {
                // Create a temporary directory
                tmpDir = tmp.dirSync({
                    unsafeCleanup: true
                });

                // Replace the dependencies in the package.json file with the ones we've found
                packageJSON.dependencies = requiredModules;
                fs.writeJsonSync(path.join(tmpDir.name, "package.json"), packageJSON);

                done(null, requiredLocalFiles)
            },
            (requiredLocalFiles, done) => {

                let filesToCopy = _.union(requiredLocalFiles, otherFiles);
                let cwd = process.cwd();

                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole) terminal.blue("Copying source files...\n");
                    progressBar = terminal.progressBar({
                        width: 80,
                        items: filesToCopy.length
                    });
                }

                async.eachOfSeries(filesToCopy, (file, index, done) => {
                    let copyToPath = path.join(tmpDir.name, file.replace(cwd, ""));
                    let filename = path.basename(file);

                    if (outputProgressToConsole) progressBar.startItem(filename);
                    fs.copy(file, copyToPath, (error) => {
                        if (outputProgressToConsole) progressBar.itemDone(filename);
                        done(error);
                    });
                }, (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal.deleteLine(1);
                    }
                    done(error);
                });
            },
            // Install all packages
            (done) => {

                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole) terminal.blue("Installing packages...\n");
                    progressBar = terminal.progressBar({
                        width: 80
                    });
                }

                exec("npm install --production", {
                    cwd: tmpDir.name
                }, (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal.deleteLine(1);
                    }
                    done(error);
                });
            },
            (done) => {
                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole) terminal.blue("Packing it up...\n");
                    progressBar = terminal.progressBar({
                        width: 80
                    });
                }

                fs.ensureDirSync(path.dirname(outputFileName));

                zip.zip(tmpDir.name + "/.", path.resolve(process.cwd(), outputFileName), (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal.deleteLine(1);
                    }
                    done(error);
                });
            }
        ], (error) => {

            function finish()
            {
                if (outputProgressToConsole) {

                    if(error)
                    {
                        terminal.error.red(`Error: ${error.toString()}`);
                    }
                    else
                    {
                        let handlerName = path.relative(process.cwd(), lambdaHandlerFilePath).replace(/.js$/, ".handler");
                        terminal.blue("You can now upload the file ").yellow(outputFileName).blue(" to AWS Lambda and set the Handler to ").yellow(handlerName).blue(".\n");
                    }
                }

                if(callback) callback(error);
            }


            // Remove our temp directory
            if (tmpDir) {
                if (outputProgressToConsole) terminal.blue("Cleaning up...\n");
                tmpDir.removeCallback(finish);
            }
            else
            {
                finish();
            }
        });

    }
}