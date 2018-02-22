#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander = require("commander");
const LambdaPack_1 = require("../LambdaPack");
const _ = require("lodash");
let lambdaHandlerFile;
let outputZipFileName;
let otherFiles;
commander
    .version(require("../package.json").version)
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
LambdaPack_1.LambdaPack.package(lambdaHandlerFile, otherFiles, outputZipFileName, !commander.quiet);
//# sourceMappingURL=cli.js.map