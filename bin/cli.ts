#! /usr/bin/env node
import * as commander from "commander";
import {LambdaPack} from "../LambdaPack";
import * as _ from "lodash";
import {terminal} from "terminal-kit";

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
    .option("-i, --include-aws", "include your own aws-sdk (if you depend on it), otherwise the Lambda globally installed version will be used")
    .parse(process.argv);

if(_.isNil(lambdaHandlerFile) || _.isNil(outputZipFileName))
{
    commander.outputHelp();
    terminal.processExit(1);
}

LambdaPack.package(lambdaHandlerFile, otherFiles, outputZipFileName, !commander.quiet, !commander.includeAws, (error) => {
    if(error)
    {
        terminal.processExit(1);
        return;
    }

    terminal.processExit(0);
});