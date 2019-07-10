"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const child_process_1 = require("child_process");
const path = require("path");
const _ = require("lodash");
const terminal_kit_1 = require("terminal-kit");
const async = require("async");
const findUp = require("find-up");
const tmp = require("tmp");
const isBuiltinModule = require("is-builtin-module");
const zipper = require("zip-local");
const dependencyTree = require("dependency-tree");
class LambdaPack {
    static package(lambdaHandlerFilePath, otherFiles, outputFileName, outputProgressToConsole = true, excludeAWSSDK = true, callback) {
        let tmpDir;
        let baseDir = path.dirname(lambdaHandlerFilePath);
        async.waterfall([
            // Find a package.json file in the path
            (done) => {
                if (outputProgressToConsole)
                    terminal_kit_1.terminal.blue("Finding package.json...\n");
                findUp("package.json", {
                    cwd: baseDir
                }).then(filepath => {
                    if (_.isNil(filepath)) {
                        done("No package.json file found in parent directory.");
                        return;
                    }
                    if (outputProgressToConsole)
                        terminal_kit_1.terminal(`package.json file ${filepath ? "was found at " + filepath : "was not found"}\n`);
                    baseDir = path.dirname(filepath);
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
                        if (match && match.length >= 2) {
                            isModule = true;
                            let moduleName = match[1];
                            let moduleVersion = "*";
                            if (excludeAWSSDK && moduleName === "aws-sdk") {
                                return false;
                            }
                            // Deal with scoped packages
                            if (moduleName.indexOf("@") !== 0) {
                                moduleName = moduleName.replace(/\/.*$/, "");
                            }
                            // Skip built-in modules and modules already added
                            if (isBuiltinModule(moduleName) || (moduleName in requiredModules)) {
                                return false;
                            }
                            if (installedPackages && installedPackages[moduleName]) {
                                moduleVersion = installedPackages[moduleName];
                            }
                            requiredModules[moduleName] = moduleVersion;
                            if (outputProgressToConsole)
                                terminal_kit_1.terminal("Found module: ").green.noFormat(`${moduleName} (${moduleVersion})\n`);
                        }
                        return !isModule;
                    }
                });
                if (outputProgressToConsole) {
                    for (let file of requiredFiles) {
                        terminal_kit_1.terminal("Found file: ").green.noFormat(`${file}\n`);
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
                done(null, requiredLocalFiles);
            },
            (requiredLocalFiles, done) => {
                let filesToCopy = _.union(requiredLocalFiles, otherFiles);
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
                    let copyToPath = path.join(tmpDir.name, file.replace(baseDir, ""));
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
                        terminal_kit_1.terminal.blue("Packing it up...\n");
                    progressBar = terminal_kit_1.terminal.progressBar({
                        width: 80
                    });
                }
                fs.ensureDirSync(path.dirname(outputFileName));
                let error;
                try {
                    zipper.sync.zip(tmpDir.name + "/.").compress().save(path.resolve(baseDir, outputFileName));
                }
                catch (err) {
                    error = err;
                }
                if (outputProgressToConsole) {
                    progressBar.stop();
                    terminal_kit_1.terminal.deleteLine(1);
                }
                done(error);
            }
        ], (error) => {
            function finish() {
                if (outputProgressToConsole) {
                    if (error) {
                        terminal_kit_1.terminal.error.red(`Error: ${error.toString()}`);
                    }
                    else {
                        let handlerName = path.relative(baseDir, lambdaHandlerFilePath).replace(/.js$/, ".handler");
                        terminal_kit_1.terminal.blue("You can now upload the file ").yellow(outputFileName).blue(" to AWS Lambda and set the Handler to ").yellow(handlerName).blue(".\n");
                    }
                }
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