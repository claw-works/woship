terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

variable "app_name"   { type = string }
variable "namespace"  { type = string }
variable "image"      { type = string }
variable "port"       { type = number }
variable "replicas"   { type = number }
variable "domain"     { type = string }
variable "cpu"        { type = string }
variable "memory"     { type = string }
variable "env"        { type = map(string) default = {} }

resource "kubernetes_namespace" "ns" {
  metadata { name = var.namespace }
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = var.app_name
    namespace = kubernetes_namespace.ns.metadata[0].name
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
    namespace = kubernetes_namespace.ns.metadata[0].name
  }

  spec {
    selector = { app = var.app_name }

    port {
      port        = 80
      target_port = var.port
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_ingress_v1" "ingress" {
  metadata {
    name      = var.app_name
    namespace = kubernetes_namespace.ns.metadata[0].name
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

output "app_name"  { value = var.app_name }
output "namespace" { value = var.namespace }
output "domain"    { value = var.domain }
output "image"     { value = var.image }
