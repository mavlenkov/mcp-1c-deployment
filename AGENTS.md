# AGENTS.md - MCP Servers for 1C:Enterprise

This repository manages Docker-based MCP (Model Context Protocol) servers for 1C:Enterprise development.

## Build/Run/Stop Commands

### Start All MCP Servers
```bash
./run_mcp.sh
```

### Individual Server Management
```bash
# Start specific server
docker run -d -p <port>:<port> -e LICENSE_KEY="<key>" <image>:latest

# Example: Graph Metadata Search
docker-compose -f Graph_metadata_search/docker-compose.yml up -d

# Example: Forms Server
docker-compose -f FormsServer/docker-compose.yml up -d

# Stop all servers
docker stop $(docker ps -q)

# View logs
docker logs <container_name>
docker logs 1c_graph_metadata
```

## MCP Servers Overview

| Server | Port | Purpose |
|--------|------|---------|
| HelpSearchServer | 8003 | 1C:Enterprise platform documentation search |
| SyntaxCheckServer | 8002 | BSL LS syntax checking |
| CodeMetadataSearchServer | 8000 | Metadata search, config docs, code patterns |
| SSLSearchServer | 8008 | Standard Library Subsystem (БСП) help |
| TemplatesSearchServer | 8004 | Code templates (public + custom) |
| 1CCodeChecker | 8007 | 1C:Partner syntax & logic checking |
| FormsServer | 8011 | Form generation context |
| Graph_metadata_search | 8006 | Graph-based metadata search (preferred) |
| CloudEmbeddingsServer | 8000 | Cloud parallel embeddings (alternative to CodeMetadata) |

## Configuration Guidelines

### Environment Files
- Copy `env.example` to `.env` before first use
- Required: `LICENSE_KEY`, paths to metadata/code directories, `OPENAI_API_KEY`
- Use absolute paths for volume mounts (Windows: `C:/path`, Linux: `/home/user/path`)

### Docker Compose Patterns
```yaml
services:
  service-name:
    image: comol/image_name:latest
    ports:
      - "${PORT:-default_port}:default_port"
    volumes:
      - "${HOST_PATH}:/container/path"
    environment:
      - LICENSE_KEY=${LICENSE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

### Common Environment Variables
- `LICENSE_KEY`: Server authentication (pre-configured in scripts)
- `METADATA_HOST_PATH`: 1C metadata .txt files directory
- `OPENAI_API_KEY`: Required for embeddings/LLM functions
- `USESSE`: Use SSE transport (true for legacy clients)
- `RESET_DATABASE`: Reindex data on startup
- `RESET_CACHE`: Reload embedding models

## Переиндексация серверов

При обновлении конфигурации 1С используйте скрипт переиндексации:
```bash
cd mcp-deployment
./scripts/reindex.sh --help                # Справка
./scripts/reindex.sh --config              # Серверы конфигурации (metadata, graph)
./scripts/reindex.sh --servers ssl,templates --yes  # Конкретные серверы
./scripts/reindex.sh --all                 # Все серверы
```

## Расширения конфигурации

Расширения 1С монтируются в контейнеры через `EXTENSIONS_PATH` (по умолчанию `${DATA_DIR}/extensions`). Каждое расширение — в отдельном подкаталоге. Поддерживается в CodeMetadataSearchServer, CloudEmbeddingsServer и Graph metadata search.

## Code Style (for 1C:Enterprise code generated via MCP)

When generating 1C:Enterprise code using these MCP servers:
- Use Russian comments for business logic explanations
- Follow 1C:Enterprise naming conventions (CamelCase for objects, snake_case for local vars)
- Indent: 4 spaces
- String literals: Use `"` for standard strings, `|` for multi-line

## Cursor Integration

Add to `mcp.json`:
```json
{
  "mcpServers": {
    "1c-graph-metadata": {
      "url": "http://localhost:8006/mcp",
      "connection_id": "graph_metadata_001"
    },
    "1c-syntax-checker": {
      "url": "http://localhost:8002/mcp",
      "connection_id": "syntax_check_001"
    }
  }
}
```

## Troubleshooting

### Container won't start
- Check Docker is running: `docker ps`
- Verify `.env` file exists and has valid paths
- Check port conflicts: `netstat -an | grep <port>`

### Indexing slow/hanging
- Indexing can take hours for large projects
- Monitor progress: `docker logs <container_name>`
- Increase memory limits in docker-compose.yml if needed

### API Key errors
- Verify `OPENAI_API_KEY` is set in `.env`
- For local LLMs (LM Studio, Ollama), use `host.docker.internal` as hostname

### Volume mount issues (Linux/Windows)
- Ensure source directories exist before starting containers
- Use forward slashes `/` in all paths (even on Windows)
- Verify user has read permissions on mounted directories
