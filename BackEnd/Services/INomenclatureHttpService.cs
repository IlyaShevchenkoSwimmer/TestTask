// типизация объекта JSON. От HTTP-сервиса в ответ получаем массив таких объектов 
// (свойство = строка и значение = элемент JSON)
using Record = System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>;

/// <summary>
/// Контракт сервиса — удобно подменять в тестах.
/// </summary>
public interface INomenclatureHttpService
{
    Task<HttpRequestResult<IReadOnlyList<Record>>> GetNomenclatureAsync(
        CancellationToken cancellationToken = default);
}