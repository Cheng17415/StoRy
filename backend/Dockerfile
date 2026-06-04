# Build (Maven del sistema: evita fallos de mvnw con CRLF al subir desde Windows)
FROM eclipse-temurin:17-jdk-alpine AS build
RUN apk add --no-cache maven
WORKDIR /app
COPY pom.xml ./
COPY src src
RUN mvn -q -DskipTests package

# Run (Cloud Run sets PORT)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/story-backend-*.jar app.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
