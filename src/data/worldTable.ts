/** id|ISO numérico|nome|continente|renda|defesa|lon|lat|recurso|terreno|litoral|vizinhos (fronteiras do Natural Earth) */
export const WORLD_TABLE = `
FJ|242|Fiji|Oceania|7|38|178|-17.8|food|planicie|1|
TZ|834|Tanzânia|África|14|71|34.7|-6.3|iron|planicie|1|CD KE ZM MW MZ BI UG RW
EH|732|Saara Ocidental|África|9|45|-12.2|24.3|food|deserto|1|MR DZ MA
CA|124|Canadá|América do Norte|35|130|-106|57|uranium|frio|1|US
US|840|Estados Unidos|América do Norte|50|190|-98|39|food|planicie|1|CA MX
KZ|398|Cazaquistão|Ásia|20|95|67.2|48.4|oil|frio|0|UZ RU KG TM CN
UZ|860|Uzbequistão|Ásia|12|60|63.4|41.8|uranium|deserto|0|KZ AF TJ KG TM
PG|598|Papua-Nova Guiné|Oceania|12|60|144.3|-6.6|oil|selva|1|ID
ID|360|Indonésia|Ásia|28|105|114|-1|iron|selva|1|PG TL MY
AR|032|Argentina|América do Sul|19|80|-64.7|-34.6|oil|planicie|1|CL UY BR BO PY
CL|152|Chile|América do Sul|20|85|-71|-28|iron|montanha|1|AR BO PE
CD|180|RD Congo|África|19|94|23.6|-2.8|iron|selva|1|TZ CF CG ZM AO BI UG RW SS
SO|706|Somália|África|12|60|45.7|4.7|iron|deserto|1|KE ET
KE|404|Quênia|África|13|63|37.8|0.6|food|planicie|1|TZ SO ET UG SS
SD|729|Sudão|África|18|88|29.8|16|oil|deserto|1|TD CF ER EG LY ET SS
TD|148|Chade|África|16|78|18.6|15.3|food|deserto|0|SD NE CM CF LY
HT|332|Haiti|América do Norte|7|39|-72.7|18.9|food|planicie|1|DO
DO|214|Rep. Dominicana|América do Norte|8|41|-70.5|18.9|oil|planicie|1|HT
RU|643|Rússia|Europa|48|205|95|62|oil|frio|1|KZ NO KP MN BY UA PL LT LV EE CN AZ GE FI
BS|044|Bahamas|América do Norte|7|37|-77.9|24.5|food|planicie|1|
FK|238|Ilhas Malvinas|América do Sul|7|37|-59.4|-51.7|food|planicie|1|
NO|578|Noruega|Europa|30|90|9|61|oil|frio|1|RU SE FI
GL|304|Groenlândia|América do Norte|19|92|-42|73.2|uranium|frio|1|
TL|626|Timor-Leste|Oceania|7|37|126|-8.8|food|planicie|1|ID
ZA|710|África do Sul|África|24|92|25.2|-28.9|iron|planicie|1|LS ZW BW NA MZ SZ
LS|426|Lesoto|África|7|39|28.2|-29.6|oil|montanha|0|ZA
MX|484|México|América do Norte|22|90|-102.2|23.9|oil|planicie|1|US GT BZ
UY|858|Uruguai|América do Sul|14|58|-56|-32.8|iron|planicie|1|AR BR
BR|076|Brasil|América do Sul|28|110|-53.2|-10.7|food|selva|1|AR UY BO PE CO VE GY SR PY
BO|068|Bolívia|América do Sul|12|60|-64.7|-16.7|iron|montanha|0|AR CL BR PE PY
PE|604|Peru|América do Sul|16|75|-74.4|-9.1|iron|montanha|1|CL BR BO CO EC
CO|170|Colômbia|América do Sul|18|80|-73.1|3.9|iron|selva|1|BR PE PA VE EC
PA|591|Panamá|América do Norte|8|43|-80.1|8.5|food|selva|1|CO CR
CR|188|Costa Rica|América do Norte|8|41|-84.2|10|food|selva|1|PA NI
NI|558|Nicarágua|América do Norte|9|47|-85|12.8|oil|selva|1|CR HN
HN|340|Honduras|América do Norte|9|46|-86.6|14.8|iron|selva|1|NI SV GT
SV|222|El Salvador|América do Norte|7|38|-88.9|13.7|food|planicie|1|HN GT
GT|320|Guatemala|América do Norte|9|46|-90.4|15.7|oil|selva|1|MX HN SV BZ
BZ|084|Belize|América do Norte|7|38|-88.7|17.2|food|selva|1|MX GT
VE|862|Venezuela|América do Sul|17|75|-66.2|7.2|oil|selva|1|BR CO GY
GY|328|Guiana|América do Sul|10|51|-59|4.8|food|selva|1|BR VE SR
SR|740|Suriname|América do Sul|9|48|-55.9|4.1|food|selva|1|BR GY
FR|250|França|Europa|46|165|2.5|46.5|uranium|planicie|1| DE CH LU BE ES IT
EC|218|Equador|América do Sul|10|52|-78.4|-1.5|oil|selva|1|PE CO
PR|630|Porto Rico|América do Norte|7|36|-66.5|18.2|iron|planicie|1|
JM|388|Jamaica|América do Norte|7|37|-77.3|18.1|oil|planicie|1|
CU|192|Cuba|América do Norte|12|72|-79|21.7|food|planicie|1|
ZW|716|Zimbábue|África|11|57|29.8|-18.9|food|planicie|0|ZA BW ZM MZ
BW|072|Botsuana|África|13|63|23.8|-22.1|food|deserto|0|ZA ZW NA ZM
NA|516|Namíbia|África|14|69|17.1|-22|uranium|deserto|1|ZA BW ZM AO
SN|686|Senegal|África|10|50|-14.5|14.4|food|planicie|1|ML MR GN GW GM
ML|466|Mali|África|16|77|-3.6|17.2|food|deserto|0|SN MR NE CI GN BF DZ
MR|478|Mauritânia|África|15|74|-10.3|20.2|iron|deserto|1|EH SN ML DZ
BJ|204|Benin|África|9|46|2.3|9.6|food|planicie|1|NE NG TG BF
NE|562|Níger|África|15|76|9.3|17.3|uranium|deserto|0|TD ML BJ NG CM BF DZ LY
NG|566|Nigéria|África|22|85|8|9.5|oil|selva|1|BJ NE CM
CM|120|Camarões|África|12|60|12.6|5.7|food|selva|1|TD NE NG CF CG GA GQ
TG|768|Togo|África|8|42|1|8.4|oil|planicie|1|BJ GH BF
GH|288|Gana|África|10|52|-1.2|7.9|oil|selva|1|TG CI BF
CI|384|Costa do Marfim|África|11|55|-5.6|7.6|food|selva|1|ML GH GN LR BF
GN|324|Guiné|África|10|52|-11.1|10.5|iron|planicie|1|SN ML CI GW LR SL
GW|624|Guiné-Bissau|África|8|40|-15.1|12|iron|planicie|1|SN GN
LR|430|Libéria|África|9|45|-9.4|6.4|iron|selva|1|CI GN SL
SL|694|Serra Leoa|África|8|43|-11.8|8.5|oil|selva|1|GN LR
BF|854|Burquina Faso|África|11|53|-1.8|12.3|food|planicie|0|ML BJ NE TG GH CI
CF|140|Rep. Centro-Africana|África|13|64|20.4|6.5|uranium|planicie|0|CD SD TD CM CG SS
CG|178|Congo|África|11|56|15.1|-0.8|iron|selva|1|CD CM CF GA AO
GA|266|Gabão|África|10|53|11.7|-0.6|oil|selva|1|CM CG GQ
GQ|226|Guiné Equatorial|África|7|39|10.4|1.6|oil|selva|1|CM GA
ZM|894|Zâmbia|África|14|67|27.8|-13.4|iron|planicie|0|TZ CD ZW BW NA MW MZ AO
MW|454|Malaui|África|9|46|34.2|-13.2|food|planicie|0|TZ ZM MZ
MZ|508|Moçambique|África|14|69|35.5|-17.2|oil|planicie|1|TZ ZA ZW ZM MW SZ
SZ|748|Essuatíni|África|7|37|31.4|-26.5|food|planicie|0|ZA MZ
AO|024|Angola|África|16|78|17.5|-12.3|oil|planicie|1|CD NA CG ZM
BI|108|Burundi|África|7|39|29.9|-3.4|oil|planicie|0|TZ CD RW
IL|376|Israel|Ásia|26|140|35|31.5|food|deserto|1|LB PS JO SY EG
LB|422|Líbano|Ásia|7|36|35.9|33.9|iron|planicie|1|IL SY
MG|450|Madagascar|África|13|63|46.7|-19.3|food|planicie|1|
PS|275|Palestina|Ásia|7|35|35.3|31.9|oil|planicie|1|IL JO
GM|270|Gâmbia|África|7|37|-15.4|13.5|food|planicie|1|SN
TN|788|Tunísia|África|9|48|9.5|34.1|iron|planicie|1|DZ LY
DZ|012|Argélia|África|19|94|2.6|28.1|oil|deserto|1|EH ML MR NE TN MA LY
JO|400|Jordânia|Ásia|9|44|36.8|31.2|uranium|deserto|1|IL PS IQ SY SA
AE|784|Emirados Árabes|Ásia|32|88|54.2|23.9|oil|deserto|1|OM SA
QA|634|Catar|Ásia|7|36|51.2|25.3|oil|deserto|1|SA
KW|414|Kuwait|Ásia|7|37|47.6|29.3|oil|deserto|1|IQ SA
IQ|368|Iraque|Ásia|12|59|43.8|33|oil|deserto|1|JO KW IR SY TR SA
OM|512|Omã|Ásia|11|55|56.1|20.6|oil|deserto|1|AE YE SA
VU|548|Vanuatu|Oceania|7|36|166.9|-15.2|oil|planicie|1|
KH|116|Camboja|Ásia|10|49|104.9|12.7|oil|selva|1|TH LA VN
TH|764|Tailândia|Ásia|21|92|101|15|food|selva|1|KH LA MM MY
LA|418|Laos|Ásia|10|52|103.8|18.4|food|selva|0|KH TH MM VN CN
MM|104|Mianmar|Ásia|13|66|96.5|20.9|iron|selva|1|TH LA IN BD CN
VN|704|Vietnã|Ásia|19|105|106.3|16.6|food|selva|1|KH LA CN
KP|408|Coreia do Norte|Ásia|10|140|127.1|40.1|iron|planicie|1|RU KP KR CN
KR|410|Coreia do Sul|Ásia|40|145|128|36.3|iron|planicie|1|KP
MN|496|Mongólia|Ásia|17|83|103|47|uranium|frio|0|RU CN
IN|356|Índia|Ásia|46|180|79.5|22.8|iron|planicie|1|MM BD BT NP PK CN
BD|050|Bangladesh|Ásia|9|47|90.3|23.8|iron|planicie|1|MM IN
BT|064|Butão|Ásia|8|40|90.5|27.4|iron|montanha|0|IN CN
NP|524|Nepal|Ásia|9|48|84|28.2|iron|montanha|0|IN CN
PK|586|Paquistão|Ásia|18|120|69.2|29.9|uranium|planicie|1|IN AF IR CN
AF|004|Afeganistão|Ásia|13|65|66|33.8|oil|montanha|0|UZ PK TJ TM IR CN
TJ|762|Tadjiquistão|Ásia|9|47|71|38.6|uranium|montanha|0|UZ AF KG CN
KG|417|Quirguistão|Ásia|10|50|74.6|41.5|uranium|montanha|0|KZ UZ TJ CN
TM|795|Turcomenistão|Ásia|12|60|59.3|39.1|oil|deserto|0|KZ UZ AF IR
IR|364|Irã|Ásia|24|125|54.5|32.5|oil|deserto|1|IQ PK AF TM AM TR AZ
SY|760|Síria|Ásia|10|50|38.5|35|food|planicie|1|IL LB JO IQ TR
AM|051|Armênia|Ásia|7|39|45|40.2|iron|montanha|0|IR TR AZ GE
SE|752|Suécia|Europa|28|95|16.1|62.4|iron|frio|1|NO FI
BY|112|Bielorrússia|Europa|10|51|28|53.5|oil|frio|0|RU UA PL LT LV
UA|804|Ucrânia|Europa|16|120|31.3|49.2|iron|frio|1|RU BY PL HU MD RO SK
PL|616|Polônia|Europa|26|110|19.3|52.1|iron|frio|1|RU BY UA LT DE SK CZ
AT|040|Áustria|Europa|9|44|14.1|47.6|food|montanha|0|HU DE CH IT SI SK CZ
HU|348|Hungria|Europa|9|44|19.3|47.2|food|planicie|0|UA AT RO HR SI SK RS
MD|498|Moldávia|Europa|8|39|28.4|47.2|food|planicie|0|UA RO
RO|642|Romênia|Europa|10|52|25|45.9|food|planicie|1|UA HU MD BG RS
LT|440|Lituânia|Europa|8|42|23.9|55.3|food|frio|1|RU BY PL LV
LV|428|Letônia|Europa|8|42|24.8|56.8|iron|frio|1|RU BY LT EE
EE|233|Estônia|Europa|8|41|25.8|58.6|iron|frio|1|RU LV
DE|276|Alemanha|Europa|50|160|10.3|51.1|iron|planicie|1|FR PL AT CH LU BE NL DK CZ
BG|100|Bulgária|Europa|9|46|25.2|42.8|food|planicie|1|RO GR TR MK RS
GR|300|Grécia|Europa|18|85|22.5|39.3|food|planicie|1|BG TR AL MK
TR|792|Turquia|Ásia|26|120|35.4|39.1|iron|planicie|1|IQ IR SY AM BG GR GE
AL|008|Albânia|Europa|7|39|20|41.1|food|montanha|1|GR MK ME
HR|191|Croácia|Europa|8|42|16|45.3|iron|planicie|1|HU SI BA RS ME
CH|756|Suíça|Europa|34|105|8.1|46.8|oil|montanha|0|FR AT DE IT
LU|442|Luxemburgo|Europa|6|34|6|49.8|food|planicie|0|FR DE BE
BE|056|Bélgica|Europa|7|39|4.6|50.7|oil|planicie|1|FR DE LU NL
NL|528|Países Baixos|Europa|34|90|5.5|52.3|iron|planicie|1|DE BE
PT|620|Portugal|Europa|9|44|-8.1|39.6|food|planicie|1|ES
ES|724|Espanha|Europa|33|120|-3.6|40.3|food|planicie|1|FR PT
IE|372|Irlanda|Europa|8|42|-8|53.2|iron|planicie|1|GB
NC|540|Nova Caledônia|Oceania|7|38|165.5|-21.3|food|planicie|1|
SB|090|Ilhas Salomão|Oceania|7|38|159.1|-7.9|food|planicie|1|
NZ|554|Nova Zelândia|Oceania|11|53|172|-42|food|planicie|1|
AU|036|Austrália|Oceania|38|125|134.2|-25.6|iron|deserto|1|
LK|144|Sri Lanka|Ásia|8|42|80.7|7.7|oil|planicie|1|
CN|156|China|Ásia|55|200|103.4|36.7|iron|planicie|1|KZ RU LA MM VN KP MN IN BT NP PK AF TJ KG
TW|158|Taiwan|Ásia|34|120|121|23.7|iron|planicie|1|
IT|380|Itália|Europa|38|135|12.4|43.4|iron|planicie|1|FR AT CH SI
DK|208|Dinamarca|Europa|8|40|9.3|56.2|oil|planicie|1|DE
GB|826|Reino Unido|Europa|45|160|-2|53.5|iron|planicie|1|IE
IS|352|Islândia|Europa|9|45|-18.8|65.1|food|frio|1|
AZ|031|Azerbaijão|Ásia|9|44|47.7|40.3|oil|planicie|0|RU IR AM GE
GE|268|Geórgia|Ásia|8|43|43.5|42.2|food|montanha|1|RU AM TR AZ
PH|608|Filipinas|Ásia|11|54|121.6|15.7|food|selva|1|
MY|458|Malásia|Ásia|11|56|102|4|iron|selva|1|ID TH BN
BN|096|Brunei|Ásia|7|36|114.9|4.7|oil|selva|1|MY
SI|705|Eslovênia|Europa|7|38|14.9|46.1|food|planicie|0|AT HU HR IT
FI|246|Finlândia|Europa|24|90|26.1|64.3|oil|frio|1|RU NO SE
SK|703|Eslováquia|Europa|8|41|19.5|48.7|iron|planicie|0|UA PL AT HU CZ
CZ|203|Tchéquia|Europa|8|44|15.3|49.8|iron|planicie|0|PL AT DE SK
ER|232|Eritreia|África|9|46|38.7|15.4|oil|deserto|1|SD ET DJ
JP|392|Japão|Ásia|45|150|138.5|36.5|iron|planicie|1|
PY|600|Paraguai|América do Sul|11|58|-58.4|-23.2|food|planicie|0|AR BR BO
YE|887|Iêmen|Ásia|12|60|47.5|15.9|iron|deserto|1|OM SA
SA|682|Arábia Saudita|Ásia|34|115|44.6|24.1|oil|deserto|1|JO AE QA KW IQ OM YE
CY|196|Chipre|Ásia|7|35|33|34.9|food|planicie|1|
MA|504|Marrocos|África|13|63|-8.7|29.8|iron|planicie|1|EH DZ
EG|818|Egito|África|20|100|29.9|26.5|food|deserto|1|SD IL LY
LY|434|Líbia|África|17|84|18|27|oil|deserto|1|SD TD NE TN DZ EG
ET|231|Etiópia|África|15|76|39.6|8.6|food|planicie|0|SO KE SD ER DJ SS
DJ|262|Djibuti|África|7|38|42.5|11.8|iron|deserto|1|ER ET
UG|800|Uganda|África|10|52|32.4|1.3|food|selva|0|TZ CD KE RW SS
RW|646|Ruanda|África|7|38|29.9|-2|food|planicie|0|TZ CD BI UG
BA|070|Bósnia|Europa|8|41|17.8|44.2|oil|planicie|1|HR RS ME
MK|807|Macedônia do Norte|Europa|7|38|21.7|41.6|food|montanha|0|BG GR AL RS
RS|688|Sérvia|Europa|8|43|20.8|44.2|uranium|planicie|0|HU RO BG HR BA MK ME
ME|499|Montenegro|Europa|7|37|19.3|42.8|iron|montanha|1|AL HR BA RS
TT|780|Trinidad e Tobago|América do Sul|7|36|-61.3|10.4|oil|planicie|1|
SS|728|Sudão do Sul|África|13|64|30.2|7.3|oil|planicie|0|CD KE SD CF ET UG
`;
