#set page(paper:"a4",flipped:true,margin:10mm)
#set text(font:"DejaVu Sans",size:10pt)
#set page(footer:context [Etapa 1 · #counter(page).display()])
= ESP32 — esquema da etapa 1
USB/fonte externa separados; alimentação externa regulada de 3,3 V. Confirmar hardware real antes de soldar. Capacitores e conectores incluídos; ADC e expansão adiados.
#image("schematic.svg",width:100%,height:165mm,fit:"contain")
