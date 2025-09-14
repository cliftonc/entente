export interface Castle {
  id: string;
  name: string;
  region: string;
  yearBuilt: number;
  description: string;
}

export interface CreateCastleRequest {
  name: string;
  region: string;
  yearBuilt: number;
  description?: string;
}

let castles: Castle[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Château de Versailles',
    region: 'Île-de-France',
    yearBuilt: 1623,
    description: 'Famous royal residence known for its opulent architecture and gardens',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Château de Fontainebleau',
    region: 'Île-de-France',
    yearBuilt: 1137,
    description: 'Historic royal palace with stunning Renaissance and classical architecture',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Château de Chambord',
    region: 'Centre-Val de Loire',
    yearBuilt: 1519,
    description: 'Iconic French Renaissance castle with distinctive French defensive architecture',
  },
];

export const getAllCastles = (): Castle[] => {
  return [...castles];
};

export const getCastleById = (id: string): Castle | undefined => {
  return castles.find(castle => castle.id === id);
};

export const createCastle = (castleData: CreateCastleRequest): Castle => {
  const newCastle: Castle = {
    id: generateId(),
    ...castleData,
    description: castleData.description || 'A beautiful castle',
  };

  castles.push(newCastle);
  return newCastle;
};

export const deleteCastle = (id: string): boolean => {
  const index = castles.findIndex(castle => castle.id === id);
  if (index === -1) {
    return false;
  }

  castles.splice(index, 1);
  return true;
};

export const resetCastles = (): void => {
  castles = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Château de Versailles',
      region: 'Île-de-France',
      yearBuilt: 1623,
      description: 'Famous royal residence known for its opulent architecture and gardens',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Château de Fontainebleau',
      region: 'Île-de-France',
      yearBuilt: 1137,
      description: 'Historic royal palace with stunning Renaissance and classical architecture',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Château de Chambord',
      region: 'Centre-Val de Loire',
      yearBuilt: 1519,
      description: 'Iconic French Renaissance castle with distinctive French defensive architecture',
    },
  ];
};

const generateId = (): string => {
  return `castle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};