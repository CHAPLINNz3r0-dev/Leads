export const handler = async (event: any) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      message: 'Operando diretamente via Firebase Cloud Firestore na nuvem.',
    }),
  };
};
