#!/bin/bash
# UniCast Pi Benchmark Runner - TCP Server Mode
# Orchestrator TCP komut sunucusu olarak çalışır.
# Windows (master) tüm zamanlama kontrolünü yapar.

echo -e "\033[0;36m=== UniCast Pi Benchmark Orchestrator ===\033[0m"
echo -e "\033[0;33mTCP Server modunda başlatılıyor...\033[0m"
echo -e "\033[0;33mDurdurmak için Ctrl+C\033[0m"
echo ""

python3 pi_orchestrator.py

echo ""
echo -e "\033[0;32mOrchestrator kapandı.\033[0m"
