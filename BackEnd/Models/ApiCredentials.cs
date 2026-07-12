// Модель данных для основных параметров запроса: логин, пароль и имя сервера
// sealed запрещает наследование
public sealed class ApiCredentials
{
    public string Login { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string BaseAddress { get; set; } = string.Empty;
}