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
      if (intentName === "GetBalanceIntent") return speak("Ji, balance ki jaankari sirf Family OS app mein available hai. Privacy ke liye.");
      if (intentName === "AddExpenseIntent") {
        const amount = slots?.amount?.value;
        const category = slots?.category?.value || "General";
        if (!amount) return speak("Maafi, amount samajh nahi aaya. Dobara boliye please.");
        const today = new Date().toISOString().split("T")[0];
        await db("transactions","POST",{family_id:FAMILY_ID,description:`${category} expense`,amount:-Math.abs(Number(amount)),category:"Other",added_by:"Munshi Jee",date:today,emoji:"💸"});
        return speak(`Haan ji! ${amount} rupaye ${category} ka kharcha darj kar diya. Shukriya!`);
      }
      if (intentName === "AddIncomeIntent") {
        const amount = slots?.amount?.value;
        if (!amount) return speak("Maafi, amount samajh nahi aaya. Dobara boliye please.");
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
        return speak(`Aaj ka menu yeh hai: ${mealTexts.join(". ")}. Bahut swadisht lagega!`);
      }
      if (intentName === "GetLowStockIntent") {
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=name,quantity,unit,par_level`);
        const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
        if (!lowStock.length) return speak("Ji sab theek hai! Pantry mein sab kuch bhar hua hai.");
        const items = lowStock.slice(0,5).map(p=>p.name).join(", ");
        return speak(`${lowStock.length} cheezein khatam hone wali hain: ${items}. Jaldi khareed lijiye ji!`);
      }
      if (intentName === "AddTaskIntent") {
        const task = slots?.task?.value;
        if (!task) return speak("Maafi, kaam samajh nahi aaya. Dobara boliye please.");
        const today = new Date().toISOString().split("T")[0];
        await db("tasks","POST",{family_id:FAMILY_ID,title:task,assignee:"Mayank",priority:"medium",category:"General",due_date:today,done:false});
        return speak(`Zaroor ji! Kaam note kar liya: ${task}. Mayank ji ko assign kar diya.`);
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
        return speak(`Subah ki report ji! ${tasks.length} kaam pending hain. ${lowStock.length} cheezein pantry mein kam hain. Aaj raat ka khaana ${dinnerName} hai. Aapka din shubh ho!`);
      }
      if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") return speak("Khuda hafiz ji! Munshi Jee hamesha aapki seva mein hazir hai.");
      return speak("Maafi ji, samajh nahi aaya. Khaana, pantry, kaam, ya kharcha ke baare mein poochh sakte hain.");
    }
    return speak("Namaste! Munshi Jee at your service.");
  } catch(err) {
    console.error("Munshi Jee error:", err);
    return speak("Maafi ji, Munshi Jee ko connection mein takleef ho rahi hai. Thodi der baad try karein.");
  }
}
