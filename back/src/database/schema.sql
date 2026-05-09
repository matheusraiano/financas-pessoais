CREATE DATABASE IF NOT EXISTS financas;
USE financas;

CREATE TABLE IF NOT EXISTS transacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(10, 2) NOT NULL,
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