K=$(grep TONAPI_KEY /opt/drain-stonfi/.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $K" "https://tonapi.io/v2/jettons/UQAtmbrLUML9h8ucXV28Sf6XAcae-CVt8EcI-ge1ivU-TAPC" | head -c 450
echo
