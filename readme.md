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
    -h, --help     output usage information

```

`lambdaHandlerFile` is the pathname of a .js file which contains your one and only Lambda.handler function.

`outputZipFileName` is the pathname of the .zip file you want to output the package.

`otherFiles` is a space or comma separated list of additional files or directories you may want to include within the deployment .zip file.

#### Example

```
$ cd my_project
$ lambpack lambda.js ./deploy/lambda.zip
```

Follow the instructions to upload and enjoy your serverless existence!

Note: lambpack won't automagically solve the issue of packaging modules with native code— in which case you'll need to run lambpack on an AWS Linux EC2 instance. Check out [lambda-packager](https://www.npmjs.com/package/lambda-packager) if you want a more complex to setup, but very full-featured packager. 