"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const child_process_1 = require("child_process");
const path = require("path");
const walker = require("module-walker");
const _ = require("lodash");
const terminal_kit_1 = require("terminal-kit");
const async = require("async");
const findUp = require("find-up");
const tmp = require("tmp");
const isBuiltinModule = require("is-builtin-module");
const zip = require("cross-zip");
class LambdaPack {
    static package(lambdaHandlerFilePath, otherFiles, outputFileName, outputProgressToConsole = true, excludeAWSSDK = true, callback) {
        let tmpDir;
        async.waterfall([
            // Find a package.json file in the path
            (done) => {
                if (outputProgressToConsole)
                    terminal_kit_1.terminal.blue("Finding package.json...\n");
                findUp("package.json").then(filepath => {
                    if (outputProgressToConsole)
                        terminal_kit_1.terminal(`package.json file ${filepath ? "was found at " + filepath : "was not found"}\n`);
                    done(null, filepath);
                });
            },
            (packageJSONFile, done) => {
                if (outputProgressToConsole)
                    terminal_kit_1.terminal.blue("Determining dependencies...\n");
                let installedPackages;
                let packageJSON = {};
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
                            if (outputProgressToConsole)
                                terminal_kit_1.terminal("Found module: ").green.noFormat(`${moduleName} (${moduleVersion})\n`);
                        }
                        else {
                            requiredLocalFiles.push(node.filename);
                            if (outputProgressToConsole)
                                terminal_kit_1.terminal("Found file: ").blue.noFormat(`${node.filename}\n`);
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
                done(null, requiredLocalFiles);
            },
            (requiredLocalFiles, done) => {
                let filesToCopy = _.union(requiredLocalFiles, otherFiles);
                let cwd = process.cwd();
                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole)
                        terminal_kit_1.terminal.blue("Copying source files...\n");
                    progressBar = terminal_kit_1.terminal.progressBar({
                        width: 80,
                        items: filesToCopy.length
                    });
                }
                async.eachOfSeries(filesToCopy, (file, index, done) => {
                    let copyToPath = path.join(tmpDir.name, file.replace(cwd, ""));
                    let filename = path.basename(file);
                    if (outputProgressToConsole)
                        progressBar.startItem(filename);
                    fs.copy(file, copyToPath, (error) => {
                        if (outputProgressToConsole)
                            progressBar.itemDone(filename);
                        done(error);
                    });
                }, (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal_kit_1.terminal.deleteLine(1);
                    }
                    done(error);
                });
            },
            // Install all packages
            (done) => {
                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole)
                        terminal_kit_1.terminal.blue("Installing packages...\n");
                    progressBar = terminal_kit_1.terminal.progressBar({
                        width: 80
                    });
                }
                child_process_1.exec("npm install --production", {
                    cwd: tmpDir.name
                }, (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal_kit_1.terminal.deleteLine(1);
                    }
                    done(error);
                });
            },
            (done) => {
                let progressBar;
                if (outputProgressToConsole) {
                    if (outputProgressToConsole)
                        terminal_kit_1.terminal.blue("Packaging it up...\n");
                    progressBar = terminal_kit_1.terminal.progressBar({
                        width: 80
                    });
                }
                zip.zip(tmpDir.name + "/.", path.resolve(process.cwd(), outputFileName), (error) => {
                    if (outputProgressToConsole) {
                        progressBar.stop();
                        terminal_kit_1.terminal.deleteLine(1);
                    }
                    done(error);
                });
            }
        ], (error) => {
            function finish() {
                if (outputProgressToConsole)
                    terminal_kit_1.terminal.green("All done!\n");
                if (callback)
                    callback(error);
            }
            // Remove our temp directory
            if (tmpDir) {
                if (outputProgressToConsole)
                    terminal_kit_1.terminal.blue("Cleaning up...\n");
                tmpDir.removeCallback(finish);
            }
            else {
                finish();
            }
        });
    }
}
exports.LambdaPack = LambdaPack;
//# sourceMappingURL=LambdaPack.js.map