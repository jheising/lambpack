import * as fs from "fs-extra"
import {exec} from 'child_process';
import * as path from "path";
import * as _ from "lodash";
import {terminal} from "terminal-kit";
import * as async from "async";
import * as findUp from "find-up";
import * as tmp from "tmp";
import * as isBuiltinModule from "is-builtin-module";
import * as zip from "cross-zip";
import * as dependencyTree from 'dependency-tree';

export class LambdaPack {
    static package(lambdaHandlerFilePath: string, otherFiles: string[], outputFileName: string, outputProgressToConsole: boolean = true, excludeAWSSDK: boolean = true, callback?: (error: Error) => void) {

        let tmpDir;
        let baseDir = path.dirname(lambdaHandlerFilePath);

        async.waterfall([
            // Find a package.json file in the path
            (done) => {
                if (outputProgressToConsole) terminal.blue("Finding package.json...\n");
                findUp("package.json", {
                    cwd: baseDir
                }).then(filepath => {

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

                let requiredModules = {};
                let requiredFiles = dependencyTree.toList({
                    filename: lambdaHandlerFilePath,
                    directory: baseDir,
                    nodeModulesConfig: {
                        entry: 'module'
                    },
                    filter: (absolutePath) => {

                        let isModule = false;
                        let match = /\/node_modules\/(.+?)\//.exec(absolutePath);

                        // This is a node module
                        if(match && match.length >= 2)
                        {
                            isModule = true;
                            let moduleName = match[1];
                            let moduleVersion = "*";

                            if(excludeAWSSDK && moduleName === "aws-sdk")
                            {
                                return false;
                            }

                            // Deal with scoped packages
                            if(moduleName.indexOf("@") !== 0)
                            {
                                moduleName = moduleName.replace(/\/.*$/, "");
                            }

                            // Skip built-in modules and modules already added
                            if(isBuiltinModule(moduleName) || (moduleName in requiredModules))
                            {
                                return false;
                            }

                            if (installedPackages && installedPackages[moduleName]) {
                                moduleVersion = installedPackages[moduleName];
                            }

                            requiredModules[moduleName] = moduleVersion;
                            if (outputProgressToConsole) terminal("Found module: ").green.noFormat(`${moduleName} (${moduleVersion})\n`);
                        }

                        return !isModule;
                    }
                });

                if (outputProgressToConsole)
                {
                    for(let file of requiredFiles)
                    {
                        terminal("Found file: ").green.noFormat(`${file}\n`);
                    }
                }

                done(null, requiredModules, requiredFiles, packageJSON);
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