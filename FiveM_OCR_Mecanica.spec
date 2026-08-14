# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs
import os

block_cipher = None

# Coletar todos os arquivos de dados (modelos onnx, configs yaml, assets)
datas = [
    ('app_icon.ico', '.'),
    ('app_icon.png', '.')
]
datas += collect_data_files('customtkinter')
datas += collect_data_files('rapidocr_onnxruntime')
datas += collect_data_files('onnxruntime')

# Coletar DLLs e binários
binaries = []
binaries += collect_dynamic_libs('onnxruntime')

# Coletar todos os submódulos ocultos
hiddenimports = []
hiddenimports += collect_submodules('customtkinter')
hiddenimports += collect_submodules('rapidocr_onnxruntime')
hiddenimports += collect_submodules('onnxruntime')
hiddenimports += ['win32clipboard', 'win32con', 'PIL', 'PIL.Image', 'PIL.ImageTk', 'PIL.ImageEnhance', 'PIL.ImageOps', 'PIL.ImageGrab']

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter.test', 'unittest', 'test', 'pytest'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='FiveM_OCR_Mecanica',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app_icon.ico',
)
