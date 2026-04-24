export type ShowItem = {
  id: string;
  name: string;
  days: string | null;
  time: string | null;
};

export const MOCK_SHOWS: ShowItem[] = [
  { id: 'mock-cambalache',   name: 'Cambalache',   days: 'Lunes a viernes', time: '8hs'  },
  { id: 'mock-el-refugio',   name: 'El Refugio',   days: 'Lunes a viernes', time: '14hs' },
  { id: 'mock-vamos-viento', name: 'Vamos Viento', days: 'Lunes a viernes', time: '16hs' },
  { id: 'mock-pinto-vermut', name: 'Pintó Vermut',  days: 'Lunes a viernes', time: '18hs' },
];
