# Set Database
## Laush SSH EC2
- ssh -i key.pem ec2-user@<PublicDNS>
- sudo dnf install postgresql15 -y
## Connect RDS and install
- psql -h <RDS-endpoint> -U (user) -d (database) -p (port)
- CREATE EXTENSION postgis;
- CREATE EXTENSION postgis_topology;