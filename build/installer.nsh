!macro customInstall
  WriteRegStr HKCU "Software\RegisteredApplications" "Fuxian" "Software\Fuxian\Capabilities"
  WriteRegStr HKCU "Software\Fuxian\Capabilities" "ApplicationName" "Fuxian"
  WriteRegStr HKCU "Software\Fuxian\Capabilities" "ApplicationDescription" "浮现是一款专注于成品 Markdown 文档阅读的桌面应用。"
  WriteRegStr HKCU "Software\Fuxian\Capabilities\FileAssociations" ".md" "Fuxian.Markdown"
  WriteRegStr HKCU "Software\Fuxian\Capabilities\FileAssociations" ".markdown" "Fuxian.Markdown"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "Fuxian"
  DeleteRegKey HKCU "Software\Fuxian\Capabilities"
  DeleteRegKey /ifempty HKCU "Software\Fuxian"
!macroend
