; Close the running app + its Python backend before installing/uninstalling so
; the files aren't locked (avoids the "abort / retry / ignore" prompt).

!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /T /IM twitch-farmer-backend.exe'
  nsExec::Exec 'taskkill /F /T /IM "Twitch Farmer.exe"'
  nsExec::Exec 'taskkill /F /T /IM twitch-farmer.exe'
  Sleep 800
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /T /IM twitch-farmer-backend.exe'
  nsExec::Exec 'taskkill /F /T /IM "Twitch Farmer.exe"'
  nsExec::Exec 'taskkill /F /T /IM twitch-farmer.exe'
  Sleep 800
!macroend
