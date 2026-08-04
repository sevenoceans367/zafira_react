/** User Guides from php/module_cbt.php + showguidepdf.php */

export const USER_GUIDES = [
  {
    id: '1',
    title: 'Seven Oceans Commercials - Chartering',
    fileName: 'User Manual_Seven Oceans Commercial_Chartering.pdf',
  },
  {
    id: '2',
    title: 'Seven Oceans Commercials - Operations',
    fileName: 'User Manual_Seven Oceans Commercial_Operations.pdf',
  },
  {
    id: '3',
    title: 'Seven Oceans Commercials - F & A',
    fileName: 'User Manual_Seven Oceans Commercial_F&A.pdf',
  },
];

export function getUserGuideById(id) {
  return USER_GUIDES.find((guide) => String(guide.id) === String(id)) || null;
}

export function getUserGuideAttachmentUrl(fileName) {
  return `/attachment/${encodeURIComponent(fileName)}`;
}
