// Inicializa o Supabase corretamente
const { createClient } = window.supabase; // <- Aqui está a correção!

const supabaseUrl = "https://ywiynndaowlifbqcsacc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aXlubmRhb3dsaWZicWNzYWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4NzgyNzAsImV4cCI6MjA1NzQ1NDI3MH0.7xH0Dpq_XYPFDJ2OmPFO-It3C5BIV_vWVLiNu7p1BFA"

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase inicializado:", supabase);

const { data, error } = await supabase.auth.signUp({
  email: "exemplo@email.com",
  password: "123456",
});

if (data.user) {
  await supabase.from("profiles").insert([
    { id: data.user.id, username: "Nome do usuário" }
  ]);
}
