const N8N_URL = import.meta.env.VITE_N8N_URL || 'https://n8n.arkeup.com';

const sendRequest = async (data:string, userId: string) => {
  try {
    const res = await fetch(`${N8N_URL}/webhook/6d388dd5-5ef0-4574-b13d-0969fa382e04`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Config': 'd2e539b6-25b6-4606-a6c2-10a47691179d',
      },
      body: JSON.stringify({
        data: data,
        userId: userId
      })
    })
    console.log({res});
    
    if(!res.ok){
      throw new Error(JSON.stringify(res))
    }
    const dataRes = await res.json() as {output:string}
    return dataRes.output
  } catch (error) {
    console.error(error)
    throw new Error(JSON.stringify(error))
  }
  
}

const ping = async ()=>{
  try {
    const res = await fetch(`${N8N_URL}/webhook/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    console.log({res});
    
    if(!res.ok){
      throw new Error(JSON.stringify(res))
    }
    const dataRes = await res.json() as {output:string}
    return dataRes.output
  } catch (error) {
    console.error(error)
    throw new Error(JSON.stringify(error))
  }
}

export default{
  sendRequest,
  ping
}