// типизация объекта JSON. От HTTP-сервиса в ответ получаем массив таких объектов 
// (свойство = строка и значение = элемент JSON)
using Record = System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>;

// контракт: описывает, что сервис умеет, но не как. Нужен для DI
public interface INomenclatureHttpService
{
    Task<HttpRequestResult<IReadOnlyList<Record>>> GetNomenclatureAsync(
        CancellationToken cancellationToken = default);
}