# lambpack

A no nonsense AWS Lambda function packager for node.js— it walks the dependency tree of a lambda handler source file and packages it up into the smallest .zip file suitable for uploading to AWS Lambda.

### Installing It

`npm install lambpack -g`

### Using It
```
$ lambpack

  Usage: lambpack [options] <lambdaHandlerFile> <outputZipFileName> [otherFiles...]


  Options:

    -V, --version  output the version number
    -q, --quiet    quiet mode
    -f, --flatten  flatten the lambda path so the resulting handler is at the root of the zip
    -i, --include-aws  include your own aws-sdk (if you depend on it), otherwise the Lambda globally installed version will be used
    -h, --help     output usage information

```

`lambdaHandlerFile` is the pathname of a .js file which contains your one and only Lambda.handler function.

`outputZipFileName` is the pathname of the .zip file you want to output the package.

`otherFiles` is a space or comma separated list of additional files or directories you may want to include within the deployment .zip file.

`-i, --include-aws`: Normally all Lambda functions have access to a globally installed `aws-sdk` package, so it's usually wasteful to upload it with your code (if you use it). However if there is a specific version in your package.json file that you want to use, you can use this switch to force it to include the one you specify. If you don't use `aws-sdk` at all in your code, then this switch won't really change anything.

`-f, --flatten`: lambpack normally preserves the location of all files and recreates this structure in the zip. If you use a monorepo approach and have multiple lambda functions inside different folders in can get tedious to keep the name of the handler inside AWS in sync with the folder structure. This options will flatten the resulting directories and place your function at the root of the zip. You can then simply specify the name of the handler like `index-handler.js` instead of `functions/function-one/index-handler.js`. If any required dependencies would break as a result of this the client fails with a warning to remove this option.

#### Example

```
$ cd my_project
$ lambpack lambda.js ./deploy/lambda.zip
```

Follow the instructions to upload and enjoy your serverless existence!

Note: lambpack won't automagically solve the issue of packaging modules with native code— in which case you'll need to run lambpack on an AWS Linux EC2 instance. Check out [lambda-packager](https://www.npmjs.com/package/lambda-packager) if you want a more complex to setup, but very full-featured packager. 