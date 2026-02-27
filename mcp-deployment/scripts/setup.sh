#!/bin/bash
set -e

echo "=== Первичная настройка MCP серверов ==="

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "Ошибка: файл .env не найден!"
    echo "Скопируйте .env.example в .env и заполните необходимые параметры:"
    echo "  cp .env.example .env"
    echo "Затем отредактируйте .env:"
    echo "  nano .env"
    exit 1
fi

# Загрузка переменных окружения
export $(cat .env | grep -v '^#' | xargs)

# Проверка обязательных переменных
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openrouter_key_here" ]; then
    echo "Ошибка: OPENAI_API_KEY не задан или имеет дефолтное значение!"
    echo "Отредактируйте .env и укажите ваш OpenRouter API ключ."
    exit 1
fi

# Создание директорий для данных
echo "Создание директорий для данных в ${DATA_DIR}..."
mkdir -p "${DATA_DIR}"/{docs_db,metadata_db,ssl,templates,forms,forms_db,report,files}

# Проверка существования файлов метаданных
if [ ! -f "${METADATA_HOST_PATH}/ОтчетПоКонфигурации.txt" ] && [ ! -f "${METADATA_HOST_PATH}"/*.txt ]; then
    echo "Предупреждение: отчет по метаданным не найден в ${METADATA_HOST_PATH}"
    echo "Вам необходимо скопировать файлы метаданных в указанную директорию."
fi

# Проверка платформы 1С
if [ ! -d "${1C_BIN_PATH}" ]; then
    echo "Ошибка: платформа 1С не найдена по пути ${1C_BIN_PATH}"
    echo "Отредактируйте 1C_BIN_PATH в .env файле."
    exit 1
fi

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "Ошибка: Docker не установлен!"
    echo "Установите Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "=== Настройка завершена успешно! ==="
echo ""
echo "Дальнейшие действия:"
echo "  ./scripts/install-services.sh  # Установка systemd сервисов (опционально)"
echo "  ./scripts/start.sh            # Запуск всех серверов"
echo "  ./scripts/status.sh            # Проверка статуса"
