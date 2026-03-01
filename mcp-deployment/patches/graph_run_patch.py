#!/usr/bin/env python3
"""
Monkey-patch for comol/1c_graph_metadata container.

Bug: web_server.combined_lifespan initializes web_server.vector_indexer
and web_server.neo4j_loader, but MCP tools (business_search, search_code)
read mcp_server.vector_indexer and mcp_server.neo4j_loader which are
never set in web mode. This patch syncs them after startup.

Remove this file once the vendor fixes the issue.
"""
import threading


def _sync_modules():
    import time
    import logging
    log = logging.getLogger('patch')

    import mcp_server
    import web_server

    synced = set()
    for _ in range(120):  # try for up to 2 minutes
        time.sleep(1)
        for attr in ('vector_indexer', 'neo4j_loader'):
            if attr in synced:
                continue
            src = getattr(web_server, attr, None)
            if src is not None and getattr(mcp_server, attr, None) is None:
                setattr(mcp_server, attr, src)
                log.info('PATCH: synced web_server.%s -> mcp_server.%s', attr, attr)
                synced.add(attr)
        if synced >= {'vector_indexer', 'neo4j_loader'}:
            break


threading.Thread(target=_sync_modules, daemon=True).start()

import main
main.main()
