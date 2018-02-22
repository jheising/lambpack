#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander = require("commander");
const LambdaPack_1 = require("../LambdaPack");
const _ = require("lodash");
let lambdaHandlerFile;
let outputZipFileName;
let otherFiles;
let packageJSON = require("../package.json");
commander
    .version(packageJSON.version)
    .description(packageJSON.description)
    .arguments("<lambdaHandlerFile> <outputZipFileName> [otherFiles...]")
    .action(function (_lambdaHandlerFile, _outputZipFileName, _otherFiles) {
    lambdaHandlerFile = _lambdaHandlerFile;
    outputZipFileName = _outputZipFileName;
    otherFiles = _otherFiles;
})
    .option("-q, --quiet", "quiet mode")
    .parse(process.argv);
if (_.isNil(lambdaHandlerFile) || _.isNil(outputZipFileName)) {
    commander.outputHelp();
    process.exit(1);
}
LambdaPack_1.LambdaPack.package(lambdaHandlerFile, otherFiles, outputZipFileName, !commander.quiet, true, (error) => {
    if (error) {
        process.exit(1);
        return;
    }
    process.exit();
});
//# sourceMappingURL=cli.js.map