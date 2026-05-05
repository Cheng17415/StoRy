package com.story.controller;

import com.story.service.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/files")
public class PublicFileController {

    private final FileStorageService fileStorageService;

    public PublicFileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> get(@PathVariable String filename) {
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        Path root = fileStorageService.getUploadRoot();
        Path file = root.resolve(filename).normalize();
        if (!file.startsWith(root) || !Files.isReadable(file)) {
            return ResponseEntity.notFound().build();
        }
        try {
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }
            String contentType = Files.probeContentType(file);
            MediaType mediaType = contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM;
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, mediaType.toString())
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
