terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "instance_name"     { type = string }
variable "db_type"           { type = string }
variable "engine_version" {
  type    = string
  default = ""
}
variable "storage_gb"        { type = number }
variable "high_availability" { type = bool }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }

variable "allowed_cidr" {
  type    = string
  default = "10.0.0.0/8"
}

locals {
  engine_map = {
    postgresql = "postgres"
    mysql      = "mysql"
  }
  engine = lookup(local.engine_map, var.db_type, var.db_type)

  is_rds     = contains(["postgresql", "mysql"], var.db_type)
  is_redis   = var.db_type == "redis"
  is_docdb   = var.db_type == "mongodb"

  port_map = {
    postgresql = 5432
    mysql      = 3306
    redis      = 6379
    mongodb    = 27017
  }
  db_port = lookup(local.port_map, var.db_type, 5432)
}

# ─── Security Group (shared by RDS and Redis) ───

resource "aws_security_group" "db" {
  count       = local.is_rds || local.is_redis || local.is_docdb ? 1 : 0
  name        = "${var.instance_name}-db-sg"
  description = "Woship managed security group - internal only"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = local.db_port
    to_port     = local.db_port
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
    description = "Allow access from internal network only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { ManagedBy = "woship" }
}

# ─── RDS (PostgreSQL / MySQL) ───

resource "aws_db_subnet_group" "db" {
  count      = local.is_rds ? 1 : 0
  name       = "${var.instance_name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = { ManagedBy = "woship" }
}

resource "aws_db_instance" "db" {
  count = local.is_rds ? 1 : 0

  identifier     = var.instance_name
  engine         = local.engine
  engine_version = var.engine_version != "" ? var.engine_version : null

  instance_class    = "db.t3.micro"
  allocated_storage = var.storage_gb
  storage_type      = "gp3"

  db_name  = replace(var.instance_name, "-", "_")
  username = "woship"
  password = "changeme-use-secrets-manager"

  multi_az            = var.high_availability
  publicly_accessible = false

  db_subnet_group_name   = aws_db_subnet_group.db[0].name
  vpc_security_group_ids = [aws_security_group.db[0].id]

  skip_final_snapshot = true

  tags = { ManagedBy = "woship", Ticket = var.instance_name }
}

# ─── ElastiCache (Redis) ───

resource "aws_elasticache_subnet_group" "redis" {
  count      = local.is_redis ? 1 : 0
  name       = "${var.instance_name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = { ManagedBy = "woship" }
}

resource "aws_elasticache_cluster" "redis" {
  count = local.is_redis ? 1 : 0

  cluster_id      = var.instance_name
  engine          = "redis"
  engine_version  = var.engine_version != "" ? var.engine_version : null
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis[0].name
  security_group_ids = [aws_security_group.db[0].id]

  tags = { ManagedBy = "woship", Ticket = var.instance_name }
}

# ─── DocumentDB (MongoDB) ───

resource "aws_docdb_subnet_group" "docdb" {
  count      = local.is_docdb ? 1 : 0
  name       = "${var.instance_name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = { ManagedBy = "woship" }
}

resource "aws_docdb_cluster" "docdb" {
  count = local.is_docdb ? 1 : 0

  cluster_identifier  = var.instance_name
  engine              = "docdb"
  engine_version      = var.engine_version != "" ? var.engine_version : null
  master_username     = "woship"
  master_password     = "changeme-use-secrets-manager"
  port                = 27017
  skip_final_snapshot = true

  db_subnet_group_name   = aws_docdb_subnet_group.docdb[0].name
  vpc_security_group_ids = [aws_security_group.db[0].id]

  tags = { ManagedBy = "woship", Ticket = var.instance_name }
}

resource "aws_docdb_cluster_instance" "docdb" {
  count = local.is_docdb ? 1 : 0

  identifier         = "${var.instance_name}-0"
  cluster_identifier = aws_docdb_cluster.docdb[0].id
  instance_class     = "db.t3.medium"

  tags = { ManagedBy = "woship" }
}

# ─── Outputs ───

output "instance_name"     { value = var.instance_name }
output "db_type"           { value = var.db_type }
output "engine"            { value = local.engine }

output "endpoint" {
  value = (
    local.is_rds && length(aws_db_instance.db) > 0
    ? aws_db_instance.db[0].endpoint
    : local.is_redis && length(aws_elasticache_cluster.redis) > 0
      ? "${aws_elasticache_cluster.redis[0].cache_nodes[0].address}:${aws_elasticache_cluster.redis[0].cache_nodes[0].port}"
      : local.is_docdb && length(aws_docdb_cluster.docdb) > 0
        ? "${aws_docdb_cluster.docdb[0].endpoint}:27017"
        : "n/a"
  )
}

output "port"              { value = local.db_port }
output "storage_gb"        { value = var.storage_gb }
output "high_availability" { value = var.high_availability }

output "security_group_id" {
  value = length(aws_security_group.db) > 0 ? aws_security_group.db[0].id : "n/a"
}
