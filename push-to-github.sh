#!/bin/bash

# Inisialisasi repositori git jika belum ada
git init

# Menambahkan remote origin (mengabaikan error jika sudah ada)
git remote add origin git@github.com:kangdidipro/anggrek_tiga.git 2>/dev/null || git remote set-url origin git@github.com:kangdidipro/anggrek_tiga.git

# Menambahkan semua perubahan
git add .

# Melakukan commit
git commit -m "Initial commit from Firebase Studio"

# Memastikan branch utama adalah 'main'
git branch -M main

# Melakukan push ke repositori (menggunakan -u untuk set upstream)
git push -u origin main
