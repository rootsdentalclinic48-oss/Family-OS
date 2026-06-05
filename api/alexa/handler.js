export default async function handler(req, res) {
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
  const db = async (table, method="GET", body=null, query="") => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method,
      headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json","Prefer":method==="POST"?"return=representation":""},
      body: body ? JSON.stringify(body) : null,
    });
    return r.json();
  };
  try {
    if (requestType === "LaunchRequest") {
      const txns = await db("transactions","GET",null,`?family_id=eq.${FAMILY_ID}&select=amount`);
      const income = txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
      const spent = txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
      const balance = income - spent;
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
      return askMore(`Welcome to Family OS! Balance is ${balance.toLocaleString("en-IN")} rupees. ${tasks.length} pending tasks. ${lowStock.length} pantry items low. Tonight's dinner is ${dinnerName}. What would you like to do?`);
    }
    if (requestType === "IntentRequest") {
      if (intentName === "GetBalanceIntent") {
        const txns = await db("transactions","GET",null,`?family_id=eq.${FAMILY_ID}&select=amount`);
        const income = txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
        const spent = txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
        return speak(`Your balance is ${(income-spent).toLocaleString("en-IN")} rupees. Income ${income.toLocaleString("en-IN")}, expenses ${spent.toLocaleString("en-IN")} rupees.`);
      }
      if (intentName === "AddExpenseIntent") {
        const amount = slots?.amount?.value;
        const category = slots?.category?.value || "General";
        if (!amount) return speak("I did not catch the amount. Please try again.");
        const today = new Date().toISOString().split("T")[0];
        await db("transactions","POST",{family_id:FAMILY_ID,description:`${category} expense`,amount:-Math.abs(Number(amount)),category:"Other",added_by:"Alexa",date:today,emoji:"💸"});
        const txns = await db("transactions","GET",null,`?family_id=eq.${FAMILY_ID}&select=amount`);
        const bal = txns.reduce((a,t)=>a+Number(t.amount),0);
        return speak(`Done! ${amount} rupees recorded for ${category}. New balance is ${bal.toLocaleString("en-IN")} rupees.`);
      }
      if (intentName === "AddIncomeIntent") {
        const amount = slots?.amount?.value;
        if (!amount) return speak("I did not catch the amount. Please try again.");
        const today = new Date().toISOString().split("T")[0];
        await db("transactions","POST",{family_id:FAMILY_ID,description:"Clinic Income",amount:Math.abs(Number(amount)),category:"Clinic Income",added_by:"Alexa",date:today,emoji:"🏥"});
        const txns = await db("transactions","GET",null,`?family_id=eq.${FAMILY_ID}&select=amount`);
        const bal = txns.reduce((a,t)=>a+Number(t.amount),0);
        return speak(`Clinic income of ${amount} rupees recorded. New balance is ${bal.toLocaleString("en-IN")} rupees.`);
      }
      if (intentName === "GetMealPlanIntent") {
        const today = new Date().toISOString().split("T")[0];
        const meals = await db("meal_plan","GET",null,`?family_id=eq.${FAMILY_ID}&plan_date=eq.${today}&select=meal_type,recipe_id`);
        if (!meals?.length) return speak("No meals planned for today.");
        const mealTexts = [];
        for (const meal of meals) {
          if (meal.recipe_id) {
            const recipe = await db("recipes","GET",null,`?id=eq.${meal.recipe_id}&select=name`);
            if (recipe?.[0]?.name) mealTexts.push(`${meal.meal_type}: ${recipe[0].name}`);
          }
        }
        return speak(`Today's meals: ${mealTexts.join(". ")}.`);
      }
      if (intentName === "GetLowStockIntent") {
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=name,quantity,unit,par_level`);
        const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
        if (!lowStock.length) return speak("Everything is well stocked!");
        const items = lowStock.slice(0,5).map(p=>`${p.name}`).join(", ");
        return speak(`${lowStock.length} items running low: ${items}.`);
      }
      if (intentName === "AddTaskIntent") {
        const task = slots?.task?.value;
        if (!task) return speak("I did not catch the task. Please try again.");
        const today = new Date().toISOString().split("T")[0];
        await db("tasks","POST",{family_id:FAMILY_ID,title:task,assignee:"Mayank",priority:"medium",category:"General",due_date:today,done:false});
        return speak(`Task added: ${task}.`);
      }
      if (intentName === "DailyBriefingIntent") {
        const txns = await db("transactions","GET",null,`?family_id=eq.${FAMILY_ID}&select=amount`);
        const bal = txns.reduce((a,t)=>a+Number(t.amount),0);
        const tasks = await db("tasks","GET",null,`?family_id=eq.${FAMILY_ID}&done=eq.false&select=id`);
        const pantry = await db("pantry","GET",null,`?family_id=eq.${FAMILY_ID}&select=quantity,par_level`);
        const lowStock = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
        return speak(`Daily briefing. Balance: ${bal.toLocaleString("en-IN")} rupees. Tasks: ${tasks.length}. Low stock: ${lowStock.length}. Have a great day!`);
      }
      if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
        return speak("Goodbye! Family OS is here whenever you need it.");
      }
      return speak("I did not understand. Ask me about balance, meals, pantry, or add expenses and tasks.");
    }
    return speak("Welcome to Family OS!");
  } catch(err) {
    console.error("Alexa error:", err);
    return speak("Sorry, I had trouble connecting. Please try again.");
  }
}
