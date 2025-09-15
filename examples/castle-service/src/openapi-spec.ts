export const openApiSpec = {
  "openapi": "3.0.3",
  "info": {
    "title": "Castle Service API",
    "version": "1.0.0",
    "description": "A simple API for managing French castles - demonstrating Entente contract testing"
  },
  "servers": [
    {
      "url": "http://localhost:4001",
      "description": "Development server"
    }
  ],
  "paths": {
    "/castles": {
      "get": {
        "operationId": "listCastles",
        "summary": "List all castles",
        "responses": {
          "200": {
            "description": "List of castles",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Castle"
                  }
                },
                "example": [
                  {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Château de Versailles",
                    "region": "Île-de-France",
                    "yearBuilt": 1623,
                    "description": "Famous royal residence known for its opulent architecture and gardens"
                  },
                  {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "name": "Château de Fontainebleau",
                    "region": "Île-de-France",
                    "yearBuilt": 1137,
                    "description": "Historic royal palace with stunning Renaissance and classical architecture"
                  }
                ]
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createCastle",
        "summary": "Add a new castle",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateCastleRequest"
              },
              "example": {
                "name": "Château de Chambord",
                "region": "Centre-Val de Loire",
                "yearBuilt": 1519,
                "description": "Iconic French Renaissance castle with distinctive French defensive architecture"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Castle created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Castle"
                },
                "example": {
                  "id": "550e8400-e29b-41d4-a716-446655440002",
                  "name": "Château de Chambord",
                  "region": "Centre-Val de Loire",
                  "yearBuilt": 1519,
                  "description": "Iconic French Renaissance castle with distinctive French defensive architecture"
                }
              }
            }
          },
          "400": {
            "description": "Invalid request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/castles/{id}": {
      "get": {
        "operationId": "getCastle",
        "summary": "Get castle by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "example": "550e8400-e29b-41d4-a716-446655440000"
          }
        ],
        "responses": {
          "200": {
            "description": "Castle found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Castle"
                },
                "example": {
                  "id": "550e8400-e29b-41d4-a716-446655440000",
                  "name": "Château de Versailles",
                  "region": "Île-de-France",
                  "yearBuilt": 1623,
                  "description": "Famous royal residence known for its opulent architecture and gardens"
                }
              }
            }
          },
          "404": {
            "description": "Castle not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      },
      "delete": {
        "operationId": "deleteCastle",
        "summary": "Delete castle by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "example": "550e8400-e29b-41d4-a716-446655440000"
          }
        ],
        "responses": {
          "204": {
            "description": "Castle deleted successfully"
          },
          "404": {
            "description": "Castle not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Castle": {
        "type": "object",
        "required": ["id", "name", "region", "yearBuilt", "description"],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Unique identifier for the castle"
          },
          "name": {
            "type": "string",
            "description": "Name of the castle",
            "example": "Château de Versailles"
          },
          "region": {
            "type": "string",
            "description": "French region where the castle is located",
            "example": "Île-de-France"
          },
          "yearBuilt": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 2100,
            "description": "Year when the castle was built",
            "example": 1623
          },
          "description": {
            "type": "string",
            "description": "Detailed description of the castle",
            "example": "Famous royal residence known for its opulent architecture and gardens"
          }
        }
      },
      "CreateCastleRequest": {
        "type": "object",
        "required": ["name", "region", "yearBuilt"],
        "properties": {
          "name": {
            "type": "string",
            "description": "Name of the castle",
            "example": "Château de Chambord"
          },
          "region": {
            "type": "string",
            "description": "French region where the castle is located",
            "example": "Centre-Val de Loire"
          },
          "yearBuilt": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 2100,
            "description": "Year when the castle was built",
            "example": 1519
          },
          "description": {
            "type": "string",
            "description": "Optional detailed description of the castle",
            "example": "Iconic French Renaissance castle with distinctive French defensive architecture"
          }
        }
      },
      "Error": {
        "type": "object",
        "required": ["error", "message"],
        "properties": {
          "error": {
            "type": "string",
            "description": "Error type",
            "example": "not_found"
          },
          "message": {
            "type": "string",
            "description": "Human-readable error message",
            "example": "Castle not found"
          }
        }
      }
    }
  }
}