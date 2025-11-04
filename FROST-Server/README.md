# Set Database
## Laush SSH EC2
- ssh -i key.pem ec2-user@<PublicDNS>
- sudo dnf install postgresql15 -y
## Connect RDS and install
- psql -h <RDS-endpoint> -U (user) -d (database) -p (port)
- CREATE EXTENSION postgis;
- CREATE EXTENSION postgis_topology;


# Docker image
## Run Docker image
- docker compose up -d

## Push Docker image to ECR
- aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
- docker pull fraunhoferiosb/frost-server:latest
- docker tag fraunhoferiosb/frost-server:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/frost-server:latest
- docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/frost-server:latest

