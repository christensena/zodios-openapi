import { makeApi } from "@zodios/core";
import { z } from "zod";
import { toOpenApi } from "./openapi";
import type { OpenAPIV3 } from "openapi-types";

const api = makeApi([
  {
    method: "get",
    path: "/events/:count",
    parameters: [
      {
        name: "count",
        type: "Path",
        schema: z.int(),
      },
      {
        name: "since",
        type: "Query",
        schema: z.iso.datetime().optional(),
      },
      {
        name: "archived",
        type: "Query",
        schema: z.stringbool(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().default(10),
      },
      {
        name: "Authorization",
        type: "Header",
        schema: z.templateLiteral(["Bearer ", z.string()]),
      },
    ],
    response: z.object({
      email: z.email(),
      deletedAt: z.string().nullable(),
    }),
  },
  {
    method: "post",
    path: "/strict-events",
    parameters: [
      {
        name: "event",
        type: "Body",
        schema: z.strictObject({ name: z.string() }),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/loose-events",
    parameters: [
      {
        name: "event",
        type: "Body",
        schema: z.looseObject({ name: z.string() }),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/notes",
    parameters: [
      {
        name: "note",
        type: "Body",
        schema: z.object({
          text: z.string().transform((t) => t.length),
        }),
      },
    ],
    response: z.void(),
  },
]);

const openApi = toOpenApi(api, { info: { title: "test", version: "1.0.0" } });

function getParam(path: string, name: string) {
  const operation = Object.values(
    openApi.paths[path] as OpenAPIV3.PathItemObject
  )[0] as OpenAPIV3.OperationObject;
  return operation.parameters?.find(
    (p) => (p as OpenAPIV3.ParameterObject).name === name
  ) as OpenAPIV3.ParameterObject;
}

function getBodySchema(path: string) {
  const operation = Object.values(
    openApi.paths[path] as OpenAPIV3.PathItemObject
  )[0] as OpenAPIV3.OperationObject;
  return (operation.requestBody as OpenAPIV3.RequestBodyObject).content[
    "application/json"
  ].schema as OpenAPIV3.SchemaObject;
}

describe("toOpenApi with zod 4 schemas", () => {
  it("should describe z.int path params as bounded integers", () => {
    expect(getParam("/events/{count}", "count").schema).toEqual({
      type: "integer",
      minimum: Number.MIN_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
    });
  });

  it("should describe optional z.iso.datetime params as non-required date-time strings", () => {
    const param = getParam("/events/{count}", "since");
    expect(param.required).toBe(false);
    expect(param.schema).toMatchObject({
      type: "string",
      format: "date-time",
    });
  });

  it("should describe z.stringbool params by their string input side", () => {
    expect(getParam("/events/{count}", "archived").schema).toEqual({
      type: "string",
    });
  });

  it("should carry .default() values into the schema", () => {
    const param = getParam("/events/{count}", "limit");
    expect(param.required).toBe(false);
    expect(param.schema).toEqual({ type: "number", default: 10 });
  });

  it("should describe z.templateLiteral headers as patterned strings", () => {
    expect(getParam("/events/{count}", "Authorization").schema).toMatchObject({
      type: "string",
      pattern: expect.stringContaining("^Bearer "),
    });
  });

  it("should describe z.email and nullable fields in responses", () => {
    const operation = (openApi.paths["/events/{count}"] as any).get;
    const schema = operation.responses["200"].content["application/json"]
      .schema as OpenAPIV3.SchemaObject;
    expect(schema.properties?.email).toMatchObject({
      type: "string",
      format: "email",
      pattern: expect.any(String),
    });
    // openapi 3.0 idiom for nullability
    expect(schema.properties?.deletedAt).toEqual({
      type: "string",
      nullable: true,
    });
  });

  it("should mark z.strictObject bodies as closed", () => {
    expect(getBodySchema("/strict-events").additionalProperties).toBe(false);
  });

  it("should mark z.looseObject bodies as open", () => {
    expect(getBodySchema("/loose-events").additionalProperties).toEqual({});
  });

  it("should describe transformed body fields by their input type", () => {
    expect(getBodySchema("/notes").properties?.text).toEqual({
      type: "string",
    });
  });
});
