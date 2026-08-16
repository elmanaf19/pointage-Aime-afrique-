@echo off
setlocal enabledelayedexpansion
REM ==================================================
REM  Demarrage automatique du serveur
REM  AIMES-AFRIQUE SOS DOCTEUR TV
REM ==================================================
REM Ce script relance automatiquement le serveur s'il
REM plante ou s'arrete de maniere inattendue, et affiche
REM les adresses a utiliser pour se connecter.
REM Pour l'arreter : ferme cette fenetre ou appuie sur Ctrl+C.

cd /d "%~dp0"

REM --- Recupere la premiere adresse IPv4 locale trouvee ---
set "LOCALIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined LOCALIP set "LOCALIP=%%a"
)
set "LOCALIP=%LOCALIP: =%"

:loop
echo.
echo ===============================================
echo   Demarrage du serveur AIMES-AFRIQUE SOS DOCTEUR TV
echo   %date% %time%
echo ===============================================
echo.
echo   Acces depuis CET ordinateur :
echo      http://localhost:3000/login.html
echo.

if not defined LOCALIP goto :noip

echo   Acces depuis un AUTRE appareil sur le meme Wi-Fi
echo   telephone, tablette, autre PC :
echo      http://%LOCALIP%:3000/login.html
goto :afterip

:noip
echo   Adresse reseau non detectee automatiquement.
echo   Tape "ipconfig" dans une autre fenetre pour la trouver
echo   manuellement, ligne "Adresse IPv4".

:afterip
echo.
echo   Si l'acces depuis un autre appareil ne fonctionne pas,
echo   verifie que Node.js est autorise dans le pare-feu Windows,
echo   reseaux prives, et que l'appareil est bien sur ce Wi-Fi.
echo ===============================================
echo.

node server.js

echo.
echo Le serveur s'est arrete ou a plante. Redemarrage dans 5 secondes...
echo Ferme cette fenetre pour arreter completement le serveur.
timeout /t 5 /nobreak >nul
goto loop
