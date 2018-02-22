# lambda-pack

A no nonsense Lambda function packager— walks the dependency tree of a lambda handler source file and packages it up into a .zip file suitable for uploading to AWS Lambda.

### Installing It

`npm install lambda-pack -g`

### Using It
```
$ lambda-pack

  Usage: lambda-pack [options] <lambdaHandlerFile> <outputZipFileName> [otherFiles...]


  Options:

    -V, --version  output the version number
    -q, --quiet    quiet mode
    -h, --help     output usage information

```

`lambdaHandlerFile` is the pathname of a .js file which contains your one and only Lambda handler function.

`outputZipFileName` is the pathname of the .zip file you want to output the results to.

`otherFiles` is a space or comma separated list of additional files or directories you may want to include within the deployment .zip file.
