#!/usr/bin/env bash
# Логи контейнера beta-контура: logs.sh help|codemeta|ssl|templates|syntaxcheck|checker|graph|neo4j [args]
set -euo pipefail
declare -A MAP=(
  [help]=1c_help_mcp_beta
  [codemeta]=1c_code_metadata_mcp_beta
  [ssl]=1c_ssl_mcp_beta
  [templates]=1c_templates_mcp_beta
  [syntaxcheck]=1c_syntaxcheck_mcp_beta
  [checker]=1c_code_checker_beta
  [graph]=1c_graph_metadata_beta
  [neo4j]=neo4j_beta
)
name="${1:?укажи сервер: ${!MAP[*]}}"
shift || true
docker logs "${MAP[$name]:?неизвестный сервер}" "$@"
