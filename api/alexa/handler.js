export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "Munshi Jee is live!" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body;
  const requestType = body?.request?.type;
  const intentName = body?.request?.intent?.name;
  const slots = body?.request?.intent?.slots;
  const speak = (text) => res.status(200).json({version:"1.0",response:{outputSpeech:{type:"PlainText",text},shouldEndSession:true}});
  const askMore = (text) => res.status(200).json({version:"1.0",response:{outputSpeech:{type:"PlainText",text},shouldEndSession:false}});
  const FAMILY_ID = "gupta-family-001";
  const SUPABASE_URL = "https://ihuuxhvxsbmzydclmbtx.supabase.co";
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const db = async (table, method="GET", dbBody=null, query="") => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method,
      headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json","Prefer":method==="POST"?"return=representation":""},
      body: dbBody ? JSON.stringify(dbBody) : null,
    });
    return r.json();
  };
  try {
    if (requestType === "LaunchRequest") {
      const tasks = await db("tasks","GET",null,`?family_id=eq.${FAMILY_ID}&done=eq.false&select=id`);
      const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=name,quantity,par_level`);
      const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
      const today = new Date().toISOString().split("T")[0];
      const dinner = await db("meal_plan","GET",null,`?family_id=eq.${FAMILY_ID}&plan_date=eq.${today}&meal_type=eq.dinner&select=recipe_id`);
      let dinnerName = "not planned";
      if (dinner?.[0]?.recipe_id) {
        const recipe = await db("recipes","GET",null,`?id=eq.${dinner[0].recipe_id}&select=name`);
        if (recipe?.[0]?.name) dinnerName = recipe[0].name;
      }
      return askMore(`Namaste! Munshi Jee at your service. You have ${tasks.length} pending tasks. ${lowStock.length > 0 ? `${lowStock.length} pantry items are running low.` : `Pantry is fully stocked.`} Tonight's dinner is ${dinnerName}. Aur kya seva kar sakta hoon?`);
    }
    if (requestType === "IntentRequest") {
      if (intentName === "GetBalanceIntent") return speak("Ji, balance ki jaankari sirf Family OS app mein available hai.");
      if (intentName === "AddExpenseIntent") {
        const amount = slots?.amount?.value;
        const category = slots?.category?.value || "General";
        if (!amount) return speak("Maafi, amount samajh nahi aaya. Dobara boliye.");
        const today = new Date().toISOString().split("T")[0];
        await db("transactions","POST",{family_id:FAMILY_ID,description:`${category} expense`,amount:-Math.abs(Number(amount)),category:"Other",added_by:"Munshi Jee",date:today,emoji:"💸"});
        return speak(`Haan ji! ${amount} rupaye ${category} ka kharcha darj kar diya.`);
      }
      if (intentName === "AddIncomeIntent") {
        const amount = slots?.amount?.value;
        if (!amount) return speak("Maafi, amount samajh nahi aaya. Dobara boliye.");
        const today = new Date().toISOString().split("T")[0];
        await db("transactions","POST",{family_id:FAMILY_ID,description:"Clinic Income",amount:Math.abs(Number(amount)),category:"Clinic Income",added_by:"Munshi Jee",date:today,emoji:"🏥"});
        return speak(`Bahut acha! Clinic ki ${amount} rupaye ki aamdani darj kar di. Mubarak ho!`);
      }
      if (intentName === "GetMealPlanIntent") {
        const today = new Date().toISOString().split("T")[0];
        const meals = await db("meal_plan","GET",null,`?family_id=eq.${FAMILY_ID}&plan_date=eq.${today}&select=meal_type,recipe_id`);
        if (!meals?.length) return speak("Aaj ka khaana plan nahi kiya gaya hai ji.");
        const mealTexts = [];
        for (const meal of meals) {
          if (meal.recipe_id) {
            const recipe = await db("recipes","GET",null,`?id=eq.${meal.recipe_id}&select=name`);
            if (recipe?.[0]?.name) mealTexts.push(`${meal.meal_type}: ${recipe[0].name}`);
          }
        }
        return speak(`Aaj ka menu: ${mealTexts.join(". ")}. Bahut swadisht lagega!`);
      }
      if (intentName === "GetLowStockIntent") {
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=name,quantity,unit,par_level`);
        const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
        if (!lowStock.length) return speak("Ji sab theek hai! Pantry mein sab kuch bhar hua hai.");
        const items = lowStock.slice(0,5).map(p=>p.name).join(", ");
        return speak(`${lowStock.length} cheezein khatam hone wali hain: ${items}. Jaldi khareed lijiye!`);
      }
      if (intentName === "AddTaskIntent") {
        const task = slots?.task?.value;
        if (!task) return speak("Maafi, kaam samajh nahi aaya. Dobara boliye.");
        const today = new Date().toISOString().split("T")[0];
        await db("tasks","POST",{family_id:FAMILY_ID,title:task,assignee:"Mayank",priority:"medium",category:"General",due_date:today,done:false});
        return speak(`Zaroor ji! Kaam note kar liya: ${task}.`);
      }
      if (intentName === "DailyBriefingIntent") {
        const tasks = await db("tasks","GET",null,`?family_id=eq.${FAMILY_ID}&done=eq.false&select=id`);
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=quantity,par_level`);
        const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
        const today = new Date().toISOString().split("T")[0];
        const dinner = await db("meal_plan","GET",null,`?family_id=eq.${FAMILY_ID}&plan_date=eq.${today}&meal_type=eq.dinner&select=recipe_id`);
        let dinnerName = "plan nahi hua";
        if (dinner?.[0]?.recipe_id) {
          const recipe = await db("recipes","GET",null,`?id=eq.${dinner[0].recipe_id}&select=name`);
          if (recipe?.[0]?.name) dinnerName = recipe[0].name;
        }
        return speak(`Subah ki report! ${tasks.length} kaam pending. ${lowStock.length} cheezein pantry mein kam. Aaj raat ${dinnerName}. Aapka din shubh ho!`);
      }
      if (intentName === "InventoryDaysIntent") {
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=name,quantity,unit,par_level`);
        const dailyUsage = {"rice":0.3,"milk":0.5,"paneer":0.2,"onion":0.1,"tomato":0.15,"oil":0.03,"wheat flour":0.2,"toor dal":0.15,"rajma":0.2};
        const predictions = pantry.map(p => {
          const usage = dailyUsage[p.name.toLowerCase()];
          if (!usage) return null;
          const days = Math.floor(Number(p.quantity) / usage);
          return {name: p.name, days};
        }).filter(Boolean).sort((a,b) => a.days - b.days);
        const critical = predictions.filter(p => p.days <= 3);
        const low = predictions.filter(p => p.days > 3 && p.days <= 7);
        let response = "";
        if (critical.length) response += `${critical.length} cheezein 3 din mein khatam ho jayengi: ${critical.map(p=>p.name+" "+p.days+" din").join(", ")}. `;
        if (low.length) response += `${low.length} cheezein ek hafte mein khatam hongi: ${low.map(p=>p.name).join(", ")}. `;
        if (!response) response = "Sab cheezein ek hafte se zyada chalenge ji!";
        return speak(response);
      }
      if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") return speak("Khuda hafiz! Munshi Jee hamesha hazir hai.");
      return speak("Maafi ji, samajh nahi aaya. Khaana, pantry, kaam, ya kharcha ke baare mein poochh sakte hain.");
    }
    return speak("Namaste! Munshi Jee at your service.");
  } catch(err) {
    console.error("Munshi Jee error:", err);
    return speak("Maafi ji, connection mein takleef ho rahi hai. Thodi der baad try karein.");
  }
}
// Extended commands added via append - see main handler
