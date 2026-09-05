# Доступ к MCP-контуру с рабочих станций (включая Windows)

Серверы на alcor слушают только `127.0.0.1` (требование лицензий и безопасности:
у templates remember/recall без авторизации). Доступ со станций — **только через
SSH-туннель** на каждой машине. Для клиентов адрес везде одинаковый:
`http://127.0.0.1:<порт>/mcp` — `mcp.json` из `CLIENT-ONBOARDING.md` переносится
на любую станцию без изменений.

Порты: 8100 codemeta, 8102 syntax (путь `/mcp`), 8103 help, 8104 templates,
8106 graph, 8107 checker, 8108 ssl.

## Предусловие (все ОС)

SSH-ключ станции должен быть допущен на alcor:

```bash
# на станции (Windows: PowerShell; ключ появится в ~/.ssh/id_ed25519.pub)
ssh-keygen -t ed25519
# добавить pubkey в authorized_keys на alcor:
ssh-copy-id l7777@alcor.altey.ru   # Windows: если нет — вручную через ssh
```

## Linux (systemd user)

Скопировать unit с эталонной машины (`~/.config/systemd/user/mcp-1c-tunnel.service`,
лежит в git-истории этого репо) или создать по образцу:

```ini
[Unit]
Description=SSH tunnel: 1C MCP servers on alcor (8100-8108)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/ssh -N -T -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o BatchMode=yes -L 8100:127.0.0.1:8100 -L 8102:127.0.0.1:8102 -L 8103:127.0.0.1:8103 -L 8104:127.0.0.1:8104 -L 8106:127.0.0.1:8106 -L 8107:127.0.0.1:8107 -L 8108:127.0.0.1:8108 alcor
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now mcp-1c-tunnel
loginctl enable-linger $USER   # чтобы жил без входа в сессию
```

## macOS

То же через `autossh` (brew install autossh) + LaunchAgent, либо tmux/screen
с тем же `ssh -N -L ...`.

## Windows 10/11 (OpenSSH встроен)

Проверка вручную (PowerShell):

```powershell
ssh -N -T -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes `
    -L 8100:127.0.0.1:8100 -L 8102:127.0.0.1:8102 -L 8103:127.0.0.1:8103 `
    -L 8104:127.0.0.1:8104 -L 8106:127.0.0.1:8106 -L 8107:127.0.0.1:8107 `
    -L 8108:127.0.0.1:8108 l7777@alcor.altey.ru
```

Автозапуск с перезапуском — скрипт `%USERPROFILE%\mcp-tunnel.ps1`:

```powershell
while ($true) {
    ssh -N -T -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes `
        -L 8100:127.0.0.1:8100 -L 8102:127.0.0.1:8102 -L 8103:127.0.0.1:8103 `
        -L 8104:127.0.0.1:8104 -L 8106:127.0.0.1:8106 -L 8107:127.0.0.1:8107 `
        -L 8108:127.0.0.1:8108 l7777@alcor.altey.ru
    Start-Sleep 5
}
```

Планировщик задач (один раз, из PowerShell админа):

```powershell
schtasks /Create /TN "mcp-1c-tunnel" /SC ONLOGON /RL LIMITED /F `
  /TR "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File %USERPROFILE%\mcp-tunnel.ps1"
```

Проверка: `curl http://127.0.0.1:8103/ready` → HTTP 200.

## Когда станций много (НЕ делать сейчас)

- WireGuard-VPN + биндинг портов на WG-интерфейс alcor;
- reverse-proxy с токен-аутентификацией перед 81xx.

Обе схемы выводят серверы с loopback — требуют отдельного решения по
безопасности (и согласования с лицензионными условиями вендора).
