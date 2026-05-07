terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {}
}

variable "app_name"   { type = string }
variable "namespace"  { type = string }
variable "image"      { type = string }
variable "port"       { type = number }
variable "replicas"   { type = number }
variable "domain"     { type = string }
variable "cpu"        { type = string }
variable "memory"     { type = string }
variable "env" {
  type    = map(string)
  default = {}
}

variable "zone_domain" {
  type    = string
  default = ""
}

variable "cluster_name" {
  type    = string
  default = ""
}

locals {
  has_dns    = var.zone_domain != "" && var.domain != ""
  has_domain = var.domain != ""
}

data "aws_eks_cluster" "cluster" {
  count = var.cluster_name != "" ? 1 : 0
  name  = var.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  count = var.cluster_name != "" ? 1 : 0
  name  = var.cluster_name
}

provider "kubernetes" {
  host                   = var.cluster_name != "" ? data.aws_eks_cluster.cluster[0].endpoint : ""
  cluster_ca_certificate = var.cluster_name != "" ? base64decode(data.aws_eks_cluster.cluster[0].certificate_authority[0].data) : ""
  token                  = var.cluster_name != "" ? data.aws_eks_cluster_auth.cluster[0].token : ""
}

# ─── Kubernetes Resources ───

# Namespace is shared across deployments — don't manage its lifecycle per-ticket.
# Create only if it doesn't exist; never destroy it when a single ticket is removed.
resource "kubernetes_namespace" "ns" {
  metadata { name = var.namespace }
  lifecycle { ignore_changes = all }
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = var.app_name
    namespace = var.namespace
    labels    = { app = var.app_name }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = { app = var.app_name }
    }

    template {
      metadata {
        labels = { app = var.app_name }
      }

      spec {
        container {
          name  = var.app_name
          image = var.image

          port {
            container_port = var.port
          }

          resources {
            requests = {
              cpu    = var.cpu
              memory = var.memory
            }
          }

          dynamic "env" {
            for_each = var.env
            content {
              name  = env.key
              value = env.value
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "svc" {
  metadata {
    name      = var.app_name
    namespace = var.namespace
  }

  spec {
    selector = { app = var.app_name }

    port {
      port        = 80
      target_port = var.port
    }

    type = "LoadBalancer"
  }
}

resource "kubernetes_ingress_v1" "ingress" {
  count = local.has_domain ? 1 : 0

  metadata {
    name      = var.app_name
    namespace = var.namespace
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
    }
  }

  spec {
    rule {
      host = var.domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.svc.metadata[0].name
              port { number = 80 }
            }
          }
        }
      }
    }
  }
}

# ─── Route53 DNS ───

data "aws_route53_zone" "zone" {
  count = local.has_dns ? 1 : 0
  name  = var.zone_domain
}

resource "aws_route53_record" "app" {
  count   = local.has_dns ? 1 : 0
  zone_id = data.aws_route53_zone.zone[0].zone_id
  name    = var.domain
  type    = "CNAME"
  ttl     = 300
  records = [kubernetes_service.svc.status[0].load_balancer[0].ingress[0].hostname]
}

# ─── Outputs ───

output "app_name"  { value = var.app_name }
output "namespace" { value = var.namespace }
output "image"     { value = var.image }
output "elb_hostname" {
  value = kubernetes_service.svc.status[0].load_balancer[0].ingress[0].hostname
}
output "access_url" {
  value = local.has_dns ? "https://${var.domain}" : "http://${kubernetes_service.svc.status[0].load_balancer[0].ingress[0].hostname}"
}
