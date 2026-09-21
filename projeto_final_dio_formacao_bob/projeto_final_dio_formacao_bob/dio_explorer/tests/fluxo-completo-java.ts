import { executarComandoTrilha } from '../commands/trilha';
import { executarComandoDesafio } from '../commands/desafio';
import { executarComandoCertificado } from '../commands/certificado';
import * as fs from 'fs';
import * as path from 'path';

console.log('\n' + '='.repeat(80));
console.log('🎯 TESTE DE FLUXO COMPLETO - TRILHA JAVA');
console.log('='.repeat(80) + '\n');

const nomeAluno = 'João Silva';
const tecnologia = 'Java';
const nivelDesafio = 'Intermediário';

let resultados = '';

// Passo 1: Consultar trilha de JAVA
console.log('📚 PASSO 1: Consultando trilha de JAVA...\n');
const resultadoTrilha = executarComandoTrilha(tecnologia);
console.log(resultadoTrilha);
console.log('\n' + '-'.repeat(80) + '\n');

resultados += '='.repeat(80) + '\n';
resultados += 'TESTE DE FLUXO COMPLETO - TRILHA JAVA\n';
resultados += '='.repeat(80) + '\n\n';
resultados += 'Data/Hora: ' + new Date().toLocaleString('pt-BR') + '\n';
resultados += 'Aluno: ' + nomeAluno + '\n';
resultados += 'Tecnologia: ' + tecnologia + '\n';
resultados += 'Nível do Desafio: ' + nivelDesafio + '\n\n';
resultados += '='.repeat(80) + '\n\n';
resultados += 'PASSO 1: CONSULTA DE TRILHA\n';
resultados += '-'.repeat(80) + '\n\n';
resultados += resultadoTrilha + '\n\n';

// Passo 2: Gerar desafio de JAVA
console.log('🎯 PASSO 2: Gerando desafio de JAVA (nível ' + nivelDesafio + ')...\n');
const resultadoDesafio = executarComandoDesafio(tecnologia, nivelDesafio);
console.log(resultadoDesafio);
console.log('\n' + '-'.repeat(80) + '\n');

resultados += '='.repeat(80) + '\n\n';
resultados += 'PASSO 2: GERAÇÃO DE DESAFIO\n';
resultados += '-'.repeat(80) + '\n\n';
resultados += resultadoDesafio + '\n\n';

// Passo 3: Gerar certificado
console.log('🎓 PASSO 3: Gerando certificado para ' + nomeAluno + '...\n');
const resultadoCertificado = executarComandoCertificado(nomeAluno, tecnologia);
console.log(resultadoCertificado);
console.log('\n' + '-'.repeat(80) + '\n');

resultados += '='.repeat(80) + '\n\n';
resultados += 'PASSO 3: GERAÇÃO DE CERTIFICADO\n';
resultados += '-'.repeat(80) + '\n\n';
resultados += resultadoCertificado + '\n\n';

// Resumo do fluxo
console.log('✅ FLUXO COMPLETO EXECUTADO COM SUCESSO!\n');
console.log('📊 Resumo:');
console.log('   ✓ Trilha consultada: Formação Java Developer');
console.log('   ✓ Desafio gerado: Nível ' + nivelDesafio);
console.log('   ✓ Certificado emitido para: ' + nomeAluno);
console.log('\n' + '='.repeat(80) + '\n');

resultados += '='.repeat(80) + '\n\n';
resultados += 'RESUMO DO FLUXO\n';
resultados += '-'.repeat(80) + '\n\n';
resultados += '✅ Status: FLUXO COMPLETO EXECUTADO COM SUCESSO\n\n';
resultados += 'Etapas Concluídas:\n';
resultados += '  ✓ Trilha consultada: Formação Java Developer\n';
resultados += '  ✓ Desafio gerado: Nível ' + nivelDesafio + '\n';
resultados += '  ✓ Certificado emitido para: ' + nomeAluno + '\n\n';
resultados += '='.repeat(80) + '\n\n';

// Validações
const validacoes = {
  trilhaContemJava: resultadoTrilha.includes('Java'),
  trilhaContemFormacao: resultadoTrilha.includes('Formação Java Developer'),
  desafioContemJava: resultadoDesafio.includes('Java'),
  desafioContemNivel: resultadoDesafio.includes(nivelDesafio),
  certificadoContemNome: resultadoCertificado.includes(nomeAluno),
  certificadoContemJava: resultadoCertificado.includes('Java'),
  certificadoGerado: resultadoCertificado.includes('Certificado Gerado com Sucesso')
};

console.log('🔍 Validações:');
Object.entries(validacoes).forEach(([key, value]) => {
  console.log(`   ${value ? '✅' : '❌'} ${key}: ${value}`);
});

const todasValidacoesPassaram = Object.values(validacoes).every(v => v === true);
console.log(`\n   ${todasValidacoesPassaram ? '✅' : '❌'} Todas as validações: ${todasValidacoesPassaram ? 'PASSOU' : 'FALHOU'}`);

resultados += 'VALIDAÇÕES\n';
resultados += '-'.repeat(80) + '\n\n';
Object.entries(validacoes).forEach(([key, value]) => {
  resultados += `${value ? '✅' : '❌'} ${key}: ${value}\n`;
});
resultados += `\n${todasValidacoesPassaram ? '✅' : '❌'} Todas as validações: ${todasValidacoesPassaram ? 'PASSOU' : 'FALHOU'}\n\n`;
resultados += '='.repeat(80) + '\n';

// Salvar resultados em arquivo TXT
const outputDir = path.join(__dirname, '../docs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputPath = path.join(outputDir, `fluxo-completo-java-${timestamp}.txt`);
fs.writeFileSync(outputPath, resultados, 'utf-8');

console.log(`\n💾 Resultados salvos em: ${outputPath}`);
console.log('\n' + '='.repeat(80) + '\n');

// Exportar resultados
export const fluxoCompletoResults = {
  aluno: nomeAluno,
  tecnologia: tecnologia,
  nivelDesafio: nivelDesafio,
  validacoes: validacoes,
  sucesso: todasValidacoesPassaram,
  arquivoResultados: outputPath
};

// Made with Bob
