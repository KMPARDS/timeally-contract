node compile.js
cp build/Eraswap_0.json ../timeally-react/src/ethereum/compiledContracts/
cp build/NRTManager_0.json ../timeally-react/src/ethereum/compiledContracts/
cp build/TimeAlly_0.json ../timeally-react/src/ethereum/compiledContracts/
node deploy.js $1
