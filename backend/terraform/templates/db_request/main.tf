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
variable "version"           { type = string }
variable "storage_gb"        { type = number }
variable "high_availability" { type = bool }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }
variable "allowed_cidr"      { type = string default = "10.0.0.0/8" }

locals {
  engine_map = {
    postgresql = "postgres"
    mysql      = "mysql"
  }
  engine         = lookup(local.engine_map, var.db_type, var.db_type)
  engine_version = var.version
  is_rds         = contains(["postgresql", "mysql"], var.db_type)

  port_map = {
    postgresql = 5432
    mysql      = 3306
  }
  db_port = lookup(local.port_map, var.db_type, 5432)
}

resource "aws_security_group" "db" {
  count       = local.is_rds ? 1 : 0
  name        = "${var.instance_name}-db-sg"
  description = "Woship managed DB security group - internal only"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = local.db_port
    to_port     = local.db_port
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
    description = "Allow DB access from internal network only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { ManagedBy = "woship" }
}

resource "aws_db_subnet_group" "db" {
  count      = local.is_rds ? 1 : 0
  name       = "${var.instance_name}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = { ManagedBy = "woship" }
}

resource "aws_db_instance" "db" {
  count = local.is_rds ? 1 : 0

  identifier     = var.instance_name
  engine         = local.engine
  engine_version = local.engine_version

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

  tags = {
    ManagedBy = "woship"
    Ticket    = var.instance_name
  }
}

output "instance_name"     { value = var.instance_name }
output "db_type"           { value = var.db_type }
output "engine"            { value = local.engine }
output "endpoint" {
  value = local.is_rds && length(aws_db_instance.db) > 0 ? aws_db_instance.db[0].endpoint : "n/a"
}
output "port"              { value = local.db_port }
output "storage_gb"        { value = var.storage_gb }
output "high_availability" { value = var.high_availability }
output "security_group_id" {
  value = local.is_rds && length(aws_security_group.db) > 0 ? aws_security_group.db[0].id : "n/a"
}
