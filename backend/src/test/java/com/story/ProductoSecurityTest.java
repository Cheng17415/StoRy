package com.story;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductoSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void listProductos_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/productos").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void estadisticasInventario_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/productos/estadisticas").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void accountMe_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/account/me").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }
}
