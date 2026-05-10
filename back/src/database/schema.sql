CREATE DATABASE IF NOT EXISTS financas;
USE financas;

CREATE TABLE IF NOT EXISTS transacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    tipo ENUM('receita', 'despesa') NOT NULL,
    categoria VARCHAR(100),
    data DATE NOT NULL,
    data_edicao DATE NULL
);

CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('receita', 'despesa', 'ambos') NOT NULL DEFAULT 'ambos'
);

-- algumas categorias padrão
INSERT INTO categorias (nome, tipo) VALUES
('Salário', 'receita'),
('Freelance', 'receita'),
('Alimentação', 'despesa'),
('Transporte', 'despesa'),
('Lazer', 'despesa'),
('Saúde', 'despesa'),
('Outros', 'ambos');

CREATE TABLE IF NOT EXISTS metas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('categoria', 'economia', 'receita', 'investimento') NOT NULL,
    categoria VARCHAR(100) NULL,        -- só para tipo = 'categoria'
    valor DECIMAL(15,2) NOT NULL,
    descricao VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('alerta', 'meta') NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    mes INT NOT NULL,
    ano INT NOT NULL
);

CREATE TABLE IF NOT EXISTS investimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('renda_fixa', 'renda_variavel') NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    cotas DECIMAL(10,4) NULL,
    operacao ENUM('aporte', 'retirada') NOT NULL DEFAULT 'aporte',
    data DATE NOT NULL
);