/**
 * Utilitário de validação de dados de veículos.
 * Bloqueia a cópia e o envio de fichas incompletas ou com '[Não identificado]'.
 */

export function isFieldValid(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // Remove colchetes e normaliza para minúsculas
  const normalized = trimmed.toLowerCase().replace(/[\[\]\(\)]/g, '').trim();
  const invalidValues = [
    'não identificado',
    'nao identificado',
    'não informado',
    'nao informado',
    'indefinido',
    'desconhecido',
    'null',
    'undefined',
    'sem placa',
    'não encontrado',
    'nao encontrado',
  ];

  if (invalidValues.includes(normalized)) {
    return false;
  }

  // Verifica se o texto ainda contém explicitamente o termo 'não identificado'
  if (normalized.includes('não identificado') || normalized.includes('nao identificado')) {
    return false;
  }

  return true;
}

export interface VehicleValidationResult {
  isPlacaValid: boolean;
  isProprietarioValid: boolean;
  isModeloValid: boolean;
  isServicoValid: boolean;
  isValid: boolean;
  missingFields: string[];
}

export function validateVehicleData(data: {
  placa?: string;
  proprietario?: string;
  modelo?: string;
  servico?: string;
}): VehicleValidationResult {
  const isPlacaValid = isFieldValid(data.placa);
  const isProprietarioValid = isFieldValid(data.proprietario);
  const isModeloValid = isFieldValid(data.modelo);
  const isServicoValid = isFieldValid(data.servico);

  const missingFields: string[] = [];
  if (!isPlacaValid) missingFields.push('Placa');
  if (!isProprietarioValid) missingFields.push('Proprietário');
  if (!isModeloValid) missingFields.push('Modelo');
  if (!isServicoValid) missingFields.push('Serviço');

  return {
    isPlacaValid,
    isProprietarioValid,
    isModeloValid,
    isServicoValid,
    isValid: isPlacaValid && isProprietarioValid && isModeloValid && isServicoValid,
    missingFields,
  };
}
