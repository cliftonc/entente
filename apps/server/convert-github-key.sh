#!/bin/bash

# GitHub App Private Key Converter
# Converts PKCS#1 private key to PKCS#8 format and base64 encodes it
# Usage: ./convert-github-key.sh <path-to-private-key.pem>

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-private-key.pem>"
    echo "Example: $0 my-github-app-private-key.pem"
    exit 1
fi

PEM_FILE="$1"

if [ ! -f "$PEM_FILE" ]; then
    echo "Error: File '$PEM_FILE' not found"
    exit 1
fi

echo "Converting $PEM_FILE to PKCS#8 format and base64 encoding..."

# Check if the file is already in PKCS#8 format
if grep -q "BEGIN PRIVATE KEY" "$PEM_FILE"; then
    echo "File is already in PKCS#8 format. Just base64 encoding..."
    base64 < "$PEM_FILE" | tr -d '\n'
    echo
elif grep -q "BEGIN RSA PRIVATE KEY" "$PEM_FILE"; then
    echo "Converting from PKCS#1 to PKCS#8 format..."
    openssl pkcs8 -topk8 -nocrypt -in "$PEM_FILE" | base64 | tr -d '\n'
    echo
else
    echo "Error: Unrecognized private key format in $PEM_FILE"
    echo "Expected 'BEGIN PRIVATE KEY' (PKCS#8) or 'BEGIN RSA PRIVATE KEY' (PKCS#1)"
    exit 1
fi

echo
echo "Copy the base64 string above and use it as your GITHUB_APP_PRIVATE_KEY environment variable."