# How to host GeoServer on Cloud ?

## STEP 1: Pull GeoServer docker image to your local machine
- Start up your docker engine
- Run the following command
```bash
docker pull docker pull docker.osgeo.org/geoserver:2.28.0
docker tag docker.osgeo.org/geoserver:2.28.0 <account_id>.dkr.ecr.<region>.amazonaws.com/geoserver:2.28.0

```
- Replace `<account_id>` and `<region>` with your actual **account id** and **region**

## STEP 2: Config your AWS credentials

- Config your AWS credentials by running
```bash
aws configure
```
Then enter your real credentials

#### NOTE: If you using Learner Lab account, Try using this command before continue. If not you can skip this part.

##### PowerShell
```bash
Set-Item -Path Env:AWS_ACCESS_KEY_ID -Value "<access_key>"
Set-Item -Path Env:AWS_SECRET_ACCESS_KEY -Value "<secret_key>"
Set-Item -Path Env:AWS_SESSION_TOKEN -Value 
Set-Item -Path Env:AWS_DEFAULT_REGION -Value "<region>"
```
- Restart you cmd and run ``aws sts get-caller-identity``

If successful, you will get response like this
``` bash
{
    "UserId": "AIDASAMPLEUSERID",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/DevAdmin"
}
```
This means you're now have authorized to do operations with **AWS Services** via aws cli

## STEP 3: Login to AWS Account
- After you got the ``aws sts get-caller-identity`` response, run these following commands

```bash
$PASSWORD = aws ecr get-login-password --region <region>
docker login --username AWS --password $PASSWORD "<account_id>.dkr.ecr.<region>.amazonaws.com" 
```
If successful, you will get the response that look like this 
```bash
Login Succeeded
```

This means you've login to your ``AWS Account``

## STEP 4: Create ECR repository 
- To create a repository in your ECR Service, run this command

```bash
aws ecr create-repository --repository-name geoserver --region <region>
```
- After running the command, you'll get response like this
```bash
{
    "repository": {
        "repositoryArn": "arn:aws:ecr:<region>:<account_id>:repository/geoserver",
        "registryId": "<account_id>",
        "repositoryName": "geoserver",
        "repositoryUri": "<account_id>.dkr.ecr.<region>.amazonaws.com/geoserver",
        "createdAt": "2025-11-16T03:46:00+00:00",
        "imageTagMutability": "MUTABLE",
        "imageScanningConfiguration": {
            "scanOnPush": false
        },
        "encryptionConfiguration": {
            "encryptionType": "AES256"
        }
    }
}
```
This means you've created a ECR repository

## STEP 5: Push GeoServer image to ECR Repository
- To do so, run this command
```bash
docker push "<ACCOUNT_IT>.dkr.ecr.<region>.amazonaws.com/geoserver:2.28.0"
```
- It might take a few minutes to upload the image

## FINAL STEP: Use the image from ECR repository that you just created to build ECS Container
